import { Router } from "express";

export const romProxyRouter = Router();

romProxyRouter.get("/rom-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
    res.status(400).json({ error: "Valid http or https URL is required" });
    return;
  }

  try {
    const upstreamRes = await fetch(targetUrl);
    if (!upstreamRes.ok || !upstreamRes.body) {
      res.status(upstreamRes.status).json({ error: "Failed to fetch upstream ROM" });
      return;
    }

    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    // Stream upstream body to client
    const reader = upstreamRes.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();
  } catch (err: unknown) {
    res.status(502).json({ error: "Error proxying ROM", details: String(err) });
  }
});
