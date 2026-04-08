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
        peers.set(peerId, { ws, peerId, sessionCode, role });

        logger.info({ sessionCode, peerId, role, totalPeers: peers.size }, "Peer joined signaling");

        if (role === "guest") {
          // Find the host and exchange introductions
          for (const [otherId, other] of peers) {
            if (otherId === peerId) continue;
            if (other.role === "host") {
              // Tell guest the host exists
              ws.send(JSON.stringify({ type: "host-info", hostPeerId: otherId }));
              // Tell host a new guest joined — host will initiate the offer
              if (other.ws.readyState === WebSocket.OPEN) {
                other.ws.send(JSON.stringify({ type: "peer-joined", peerId, role: "guest" }));
              }
            }
          }
        } else if (role === "host") {
          // Notify existing guests that host is here
          // AND notify the host about each existing guest (so it can initiate offers)
          for (const [otherId, other] of peers) {
            if (otherId === peerId) continue;

            // Tell each guest the host is now available
            if (other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(JSON.stringify({ type: "host-info", hostPeerId: peerId }));
            }

            // Tell the host about each existing guest so it can create offers
            ws.send(JSON.stringify({ type: "peer-joined", peerId: otherId, role: other.role }));
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
