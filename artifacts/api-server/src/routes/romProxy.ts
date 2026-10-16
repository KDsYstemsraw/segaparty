import { Router } from "express";
import dns from "node:dns";
import net from "node:net";
import { logger } from "../lib/logger";

export const romProxyRouter = Router();

const MAX_ROM_BYTES = 250 * 1024 * 1024; // 250 MB max limit
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 (Current network)
  if (a === 127) return true; // 127.0.0.0/8 (Loopback)
  if (a === 10) return true; // 10.0.0.0/8 (Private RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (Private RFC 1918)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (Private RFC 1918)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local & AWS/Cloud Metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (Carrier-Grade NAT)
  if (a >= 224) return true; // 224.0.0.0/4 (Multicast and reserved)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // Loopback & unspecified
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  // fe80::/10 (Link-local)
  if (/^fe[89ab]/i.test(lower)) return true;
  // fc00::/7 (Unique local addresses)
  if (/^f[cd]/i.test(lower)) return true;
  return false;
}

function isBlockedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // Reject unrecognized or malformed IPs
}

async function validateUrlSecurity(urlStr: string): Promise<{ valid: boolean; url?: URL; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http and https protocols are permitted" };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, error: "Missing hostname" };
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: "User credentials in URLs are not permitted" };
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      return { valid: false, error: "Access to private or restricted network addresses is forbidden" };
    }
    return { valid: true, url: parsed };
  }

  // Resolve hostname DNS and verify all addresses are public
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: "Failed to resolve hostname" };
    }
    for (const addr of addresses) {
      if (isBlockedIP(addr.address)) {
        return { valid: false, error: "Access to private or restricted network addresses is forbidden" };
      }
    }
  } catch {
    return { valid: false, error: "DNS resolution failed" };
  }

  return { valid: true, url: parsed };
}

romProxyRouter.get("/rom-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).json({ error: "Valid http or https URL is required" });
    return;
  }

  try {
    let currentUrl = targetUrl;
    let upstreamRes: Response | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const validation = await validateUrlSecurity(currentUrl);
      if (!validation.valid || !validation.url) {
        res.status(403).json({ error: validation.error || "Blocked URL" });
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const resp = await fetch(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "RetroParty-ROM-Proxy/1.0",
          },
        });
        clearTimeout(timeoutId);

        // Check for redirects and validate target before following
        if ([301, 302, 303, 307, 308].includes(resp.status)) {
          const location = resp.headers.get("location");
          if (!location) {
            res.status(502).json({ error: "Redirect missing location header" });
            return;
          }
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }

        upstreamRes = resp;
        break;
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        logger.warn({ err: fetchErr, currentUrl }, "ROM proxy upstream fetch failed");
        res.status(502).json({ error: "Failed to fetch upstream ROM" });
        return;
      }
    }

    if (!upstreamRes || !upstreamRes.ok || !upstreamRes.body) {
      res.status(upstreamRes ? upstreamRes.status : 502).json({ error: "Failed to fetch upstream ROM" });
      return;
    }

    // Check Content-Length if present
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_ROM_BYTES) {
      res.status(413).json({ error: "ROM file exceeds 250MB limit" });
      return;
    }

    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // Stream upstream body with total byte count enforcement
    const reader = upstreamRes.body.getReader();
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;

      if (totalBytes > MAX_ROM_BYTES) {
        logger.warn({ totalBytes, currentUrl }, "ROM proxy download exceeded 250MB cap during streaming");
        await reader.cancel();
        res.destroy();
        return;
      }

      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err: unknown) {
    logger.warn({ err }, "Unexpected error in ROM proxy");
    if (!res.headersSent) {
      res.status(502).json({ error: "Error proxying ROM" });
    }
  }
});
