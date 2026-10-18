import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { romProxyRouter } from "./routes/romProxy";
import { logger } from "./lib/logger";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";

// Allowed origins for CORS policy (SEC-17)
const ALLOWED_ORIGINS = new Set([
  "https://retroparty.onrender.com",
  "https://segaparty.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

function isAllowedCorsOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (!isProduction && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return true;
    }
    if (ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGINS.has(parsed.origin)) {
      return true;
    }
    if (parsed.hostname.endsWith(".onrender.com")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// Defensive security headers middleware (SEC-17)
app.use((req, res, next) => {
  // Cross-Origin Isolation headers for SharedArrayBuffer & WebAssembly
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

  // Standard defense-in-depth security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // Content-Security-Policy: allow scripts for Wasm/EmulatorJS, connect to WebSockets, blob/data URLs, and Google Fonts
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self' blob: data: https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob:",
      "connect-src 'self' wss: ws: blob: data: https:",
      "worker-src 'self' blob: data:",
      "frame-ancestors 'self'",
    ].join("; "),
  );

  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Restricted CORS policy (SEC-17)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedCorsOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", romProxyRouter);

// Serve static frontend in production / single-server mode
const possibleStaticDirs = [
  path.resolve(process.cwd(), "artifacts/sega-party/dist/public"),
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "../sega-party/dist/public"),
];

const staticDir = possibleStaticDirs.find((dir) => fs.existsSync(dir));

if (staticDir) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (
      req.method === "GET" &&
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/ws") &&
      !path.extname(req.path)
    ) {
      res.sendFile(path.resolve(staticDir, "index.html"));
    } else {
      next();
    }
  });
}

export default app;
