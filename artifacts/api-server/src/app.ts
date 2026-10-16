import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { romProxyRouter } from "./routes/romProxy";
import { logger } from "./lib/logger";

const app: Express = express();

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
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
app.use(cors());
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

