import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSignalingServer } from "./lib/signaling";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort) || 3000;


const server = http.createServer(app);
attachSignalingServer(server);

server.listen(port, "0.0.0.0", () => {
  logger.info({ port, host: "0.0.0.0" }, "Server listening");
});


server.on("error", (err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});
