import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "./logger";

interface PeerInfo {
  ws: WebSocket;
  peerId: string;
  sessionCode: string;
  role: "host" | "guest";
}

// sessionCode -> Map<peerId, PeerInfo>
const sessions = new Map<string, Map<string, PeerInfo>>();

function getPeers(sessionCode: string): Map<string, PeerInfo> {
  if (!sessions.has(sessionCode)) {
    sessions.set(sessionCode, new Map());
  }
  return sessions.get(sessionCode)!;
}

function removePeer(sessionCode: string, peerId: string) {
  const peers = sessions.get(sessionCode);
  if (!peers) return;
  peers.delete(peerId);
  if (peers.size === 0) {
    sessions.delete(sessionCode);
  }
}

export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let myPeerId: string | null = null;
    let mySessionCode: string | null = null;

    ws.on("message", (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === "join") {
        const sessionCode = msg.sessionCode as string;
        const role = msg.role as "host" | "guest";
        const peerId = msg.peerId as string;

        if (!sessionCode || !peerId || !role) return;

        myPeerId = peerId;
        mySessionCode = sessionCode;

        const peers = getPeers(sessionCode);

        // Save this peer
        peers.set(peerId, { ws, peerId, sessionCode, role });

        logger.info({ sessionCode, peerId, role, totalPeers: peers.size }, "Peer joined signaling");

        if (role === "guest") {
          // Tell guest about the host, and tell host about this new guest
          for (const [otherId, other] of peers) {
            if (otherId === peerId) continue;

            if (other.role === "host") {
              // Tell guest the host exists
              ws.send(JSON.stringify({ type: "host-info", hostPeerId: otherId }));

              // Tell host a new guest joined
              if (other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(JSON.stringify({ type: "peer-joined", peerId, role: "guest" }));
              }
            }
          }
        } else if (role === "host") {
          // Notify any waiting guests that host is here
          for (const [otherId, other] of peers) {
            if (otherId === peerId) continue;
            if (other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(JSON.stringify({ type: "host-info", hostPeerId: peerId }));
            }
          }
        }

        return;
      }

      if (type === "signal") {
        const sessionCode = msg.sessionCode as string;
        const targetPeerId = msg.targetPeerId as string;
        const data = msg.data;

        if (!sessionCode || !targetPeerId) return;

        const peers = getPeers(sessionCode);
        const target = peers.get(targetPeerId);

        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(
            JSON.stringify({
              type: "signal",
              fromPeerId: myPeerId,
              data,
            }),
          );
        }
        return;
      }

      if (type === "leave") {
        const sessionCode = msg.sessionCode as string;
        const peerId = msg.peerId as string;
        if (!sessionCode || !peerId) return;

        const peers = getPeers(sessionCode);
        peers.delete(peerId);

        // Notify others
        for (const [, other] of peers) {
          if (other.ws.readyState === WebSocket.OPEN) {
            other.ws.send(JSON.stringify({ type: "peer-left", peerId }));
          }
        }

        if (peers.size === 0) sessions.delete(sessionCode);
        return;
      }
    });

    ws.on("close", () => {
      if (myPeerId && mySessionCode) {
        const peers = sessions.get(mySessionCode);
        if (peers) {
          peers.delete(myPeerId);

          for (const [, other] of peers) {
            if (other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(JSON.stringify({ type: "peer-left", peerId: myPeerId }));
            }
          }

          if (peers.size === 0) sessions.delete(mySessionCode);
        }
        logger.info({ sessionCode: mySessionCode, peerId: myPeerId }, "Peer disconnected from signaling");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket signaling server attached at /ws");
}
