import { Router } from "express";
import dns from "node:dns";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { logger } from "../lib/logger";

export const romProxyRouter = Router();

const MAX_ROM_BYTES = 250 * 1024 * 1024; // 250 MB max limit
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["80", "443", "8080", "8443"]);

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
  // Alternative loopback and zero notations: ::0, 0:0:0:0:0:0:0:0, 0:0:0:0:0:0:0:1, ::0001
  if (/^0*(:0*)*:?0*1?$/.test(lower)) return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isBlockedIP(v4);
  }

  // Deprecated IPv4-compatible IPv6 (::127.0.0.1)
  if (/^::(?:\d{1,3}\.){3}\d{1,3}$/.test(lower)) {
    const v4 = lower.slice(2);
    return isBlockedIP(v4);
  }

  // fe80::/10 (Link-local)
  if (/^fe[89ab]/i.test(lower)) return true;
  // fc00::/7 (Unique local addresses)
  if (/^f[cd]/i.test(lower)) return true;
  // fec0::/10 (Deprecated site-local)
  if (/^fec[0-9a-f]/i.test(lower)) return true;
  // 64:ff9b::/96 (Translation prefix)
  if (lower.startsWith("64:ff9b:")) return true;
  // 2002::/16 (6to4 tunneling)
  if (lower.startsWith("2002:")) return true;
  // 2001:db8::/32 (Documentation)
  if (lower.startsWith("2001:db8:")) return true;
  // 100::/64 (Discard prefix)
  if (lower.startsWith("100:")) return true;

  return false;
}

export function isBlockedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // Reject unrecognized or malformed IPs
}

interface UrlValidationResult {
  valid: boolean;
  url?: URL;
  resolvedIp?: string;
  error?: string;
}

export async function validateUrlSecurity(urlStr: string): Promise<UrlValidationResult> {
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

  // Enforce allowed ports (SEC-11)
  const effectivePort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  if (!ALLOWED_PORTS.has(effectivePort)) {
    return { valid: false, error: `Port ${effectivePort} is not permitted for ROM proxying` };
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      return { valid: false, error: "Access to private or restricted network addresses is forbidden" };
    }
    return { valid: true, url: parsed, resolvedIp: hostname };
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
    return { valid: true, url: parsed, resolvedIp: addresses[0].address };
  } catch {
    return { valid: false, error: "DNS resolution failed" };
  }
}

/**
 * Executes an HTTP/HTTPS GET request with transport-level DNS pinning.
 * Prevents TOCTOU DNS rebinding (SEC-10) by enforcing connection to the pre-validated IP.
 */
function fetchWithPinnedDns(
  url: URL,
  resolvedIp: string,
  timeoutMs: number,
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;
    const effectivePort = Number(url.port || (isHttps ? 443 : 80));

    // Custom lookup callback pinning the socket to the pre-validated IP
    const pinLookup = (_hostname: string, options: unknown, callback: (err: Error | null, addresses: unknown, family?: number) => void) => {
      let cb = callback;
      let opt = options;
      if (typeof opt === "function") {
        cb = opt as (err: Error | null, addresses: unknown, family?: number) => void;
        opt = {};
      }
      const family = net.isIPv6(resolvedIp) ? 6 : 4;
      if (typeof opt === "object" && opt && (opt as { all?: boolean }).all) {
        cb(null, [{ address: resolvedIp, family }]);
      } else {
        cb(null, resolvedIp, family);
      }
    };

    const req = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: effectivePort,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": "RetroParty-ROM-Proxy/1.0",
          "Host": url.host,
        },
        lookup: pinLookup as typeof dns.lookup,
      },
      (res) => {
        resolve(res);
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Upstream ROM request timed out"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

romProxyRouter.get("/rom-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).json({ error: "Valid http or https URL is required" });
    return;
  }

  try {
    let currentUrl = targetUrl;
    let upstreamRes: http.IncomingMessage | null = null;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const validation = await validateUrlSecurity(currentUrl);
      if (!validation.valid || !validation.url || !validation.resolvedIp) {
        res.status(403).json({ error: validation.error || "Blocked URL" });
        return;
      }

      try {
        const resp = await fetchWithPinnedDns(validation.url, validation.resolvedIp, REQUEST_TIMEOUT_MS);

        // Check for redirects and validate destination before following
        const statusCode = resp.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const location = resp.headers["location"];
          resp.resume(); // Discard redirect body
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
        logger.warn({ err: fetchErr, currentUrl }, "ROM proxy upstream fetch failed");
        res.status(502).json({ error: "Failed to fetch upstream ROM" });
        return;
      }
    }

    if (!upstreamRes || (upstreamRes.statusCode && upstreamRes.statusCode >= 400)) {
      res.status(upstreamRes?.statusCode || 502).json({ error: "Failed to fetch upstream ROM" });
      return;
    }

    // Check Content-Length if present
    const contentLength = upstreamRes.headers["content-length"];
    if (contentLength && Number(contentLength) > MAX_ROM_BYTES) {
      upstreamRes.destroy();
      res.status(413).json({ error: "ROM file exceeds 250MB limit" });
      return;
    }

    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const contentType = upstreamRes.headers["content-type"];
    if (contentType) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // Stream upstream body with total byte count enforcement
    let totalBytes = 0;

    upstreamRes.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_ROM_BYTES) {
        logger.warn({ totalBytes, currentUrl }, "ROM proxy download exceeded 250MB cap during streaming");
        upstreamRes?.destroy();
        res.destroy();
        return;
      }
      res.write(chunk);
    });

    upstreamRes.on("end", () => {
      res.end();
    });

    upstreamRes.on("error", (err) => {
      logger.warn({ err }, "Error reading upstream ROM body");
      res.destroy();
    });
  } catch (err: unknown) {
    logger.warn({ err }, "Unexpected error in ROM proxy");
    if (!res.headersSent) {
      res.status(502).json({ error: "Error proxying ROM" });
    }
  }
});
