import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "./logger";

export interface SlotHolder {
  peerId: string;
  playerName: string;
  isHost: boolean;
}

export interface RoomState {
  code: string;
  hostPeerId: string | null;
  romName: string | null;
  slots: Record<number, SlotHolder | null>; // 1: P1, 2: P2, 3: P3, 4: P4
  peers: Map<string, PeerInfo>;
}

interface PeerInfo {
  ws: WebSocket;
  peerId: string;
  playerName: string;
  sessionCode: string;
  role: "host" | "guest";
}

// sessionCode -> RoomState
const rooms = new Map<string, RoomState>();

function getOrCreateRoom(sessionCode: string): RoomState {
  if (!rooms.has(sessionCode)) {
    rooms.set(sessionCode, {
      code: sessionCode,
      hostPeerId: null,
      romName: null,
      slots: {
        1: null,
        2: null,
        3: null,
        4: null,
      },
      peers: new Map(),
    });
  }
  return rooms.get(sessionCode)!;
}

function broadcastToRoom(room: RoomState, message: unknown, excludePeerId?: string) {
  const payload = JSON.stringify(message);
  for (const [peerId, peer] of room.peers) {
    if (excludePeerId && peerId === excludePeerId) continue;
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let myPeerId: string | null = null;
    let mySessionCode: string | null = null;
    let myPlayerName = "Anonymous";

    ws.on("message", (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === "join") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const role = msg.role as "host" | "guest";
        const peerId = msg.peerId as string;
        const playerName = (msg.playerName as string) || (role === "host" ? "Host" : "Guest");
        const romName = msg.romName as string | undefined;

        if (!sessionCode || !peerId || !role) return;

        myPeerId = peerId;
        mySessionCode = sessionCode;
        myPlayerName = playerName;

        const room = getOrCreateRoom(sessionCode);
        if (romName) room.romName = romName;

        if (role === "host") {
          room.hostPeerId = peerId;
          // Auto-assign host to Slot 1 if empty
          if (!room.slots[1]) {
            room.slots[1] = { peerId, playerName, isHost: true };
          }
        }

        const peerInfo: PeerInfo = { ws, peerId, playerName, sessionCode, role };
        room.peers.set(peerId, peerInfo);

        logger.info({ sessionCode, peerId, role, playerName, totalPeers: room.peers.size }, "Peer joined room");

        // Send current room state & slot state to the joining peer
        ws.send(
          JSON.stringify({
            type: "room-state",
            hostPeerId: room.hostPeerId,
            romName: room.romName,
            slots: room.slots,
            peers: Array.from(room.peers.values()).map((p) => ({
              peerId: p.peerId,
              playerName: p.playerName,
              role: p.role,
            })),
          }),
        );

        if (role === "guest") {
          // If host exists, inform the guest and prompt the host to create WebRTC offer
          if (room.hostPeerId && room.peers.has(room.hostPeerId)) {
            const hostPeer = room.peers.get(room.hostPeerId)!;
            ws.send(JSON.stringify({ type: "host-info", hostPeerId: room.hostPeerId }));
            if (hostPeer.ws.readyState === WebSocket.OPEN) {
              hostPeer.ws.send(
                JSON.stringify({
                  type: "peer-joined",
                  peerId,
                  playerName,
                  role: "guest",
                }),
              );
            }
          }
        } else if (role === "host") {
          // Host joined / re-joined: inform all guests and prompt host to offer to all existing guests
          for (const [otherId, other] of room.peers) {
            if (otherId === peerId) continue;
            if (other.ws.readyState === WebSocket.OPEN) {
              other.ws.send(JSON.stringify({ type: "host-info", hostPeerId: peerId }));
            }
            ws.send(
              JSON.stringify({
                type: "peer-joined",
                peerId: otherId,
                playerName: other.playerName,
                role: other.role,
              }),
            );
          }
        }

        // Notify other room participants
        broadcastToRoom(
          room,
          {
            type: "participant-joined",
            peerId,
            playerName,
            role,
          },
          peerId,
        );

        // Broadcast updated slot state
        broadcastToRoom(room, {
          type: "slot-state",
          slots: room.slots,
        });

        // Broadcast system chat
        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `${playerName} joined the room`,
          timestamp: Date.now(),
          isSystem: true,
        });

        return;
      }

      if (type === "signal") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const targetPeerId = msg.targetPeerId as string;
        const data = msg.data;

        if (!sessionCode || !targetPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        const target = room.peers.get(targetPeerId);
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

      if (type === "voice-signal") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const targetPeerId = msg.targetPeerId as string;
        const data = msg.data;

        if (!sessionCode || !targetPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        const target = room.peers.get(targetPeerId);
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(
            JSON.stringify({
              type: "voice-signal",
              fromPeerId: myPeerId,
              data,
            }),
          );
        }
        return;
      }

      if (type === "slot-claim") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot); // 1, 2, 3, 4
        const effectivePeerId = (msg.peerId as string) || myPeerId;
        const effectivePlayerName = (msg.playerName as string) || myPlayerName || "Player";

        if (!sessionCode || slot < 1 || slot > 4 || !effectivePeerId) return;

        myPeerId = effectivePeerId;
        mySessionCode = sessionCode;
        myPlayerName = effectivePlayerName;

        const room = getOrCreateRoom(sessionCode);

        // Check if slot is occupied by another peer
        const existing = room.slots[slot];
        if (existing && existing.peerId !== effectivePeerId) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Player ${slot} is already occupied by ${existing.playerName}.`,
            }),
          );
          return;
        }

        // Release any other slot held by this peer
        for (let i = 1; i <= 4; i++) {
          if (room.slots[i]?.peerId === effectivePeerId && i !== slot) {
            room.slots[i] = null;
          }
        }

        const isHost = effectivePeerId === room.hostPeerId;
        room.slots[slot] = {
          peerId: effectivePeerId,
          playerName: effectivePlayerName,
          isHost,
        };

        logger.info({ sessionCode, peerId: effectivePeerId, slot, playerName: effectivePlayerName }, "Slot claimed");

        broadcastToRoom(room, {
          type: "slot-state",
          slots: room.slots,
        });

        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `🎮 ${effectivePlayerName} claimed Player ${slot} controller`,
          timestamp: Date.now(),
          isSystem: true,
        });

        return;
      }

      if (type === "slot-release") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot);
        const effectivePeerId = (msg.peerId as string) || myPeerId;
        const effectivePlayerName = (msg.playerName as string) || myPlayerName || "Player";

        if (!sessionCode || !effectivePeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        let releasedSlot = 0;
        if (slot >= 1 && slot <= 4) {
          if (room.slots[slot]?.peerId === effectivePeerId) {
            room.slots[slot] = null;
            releasedSlot = slot;
          }
        } else {
          // Release any slot held
          for (let i = 1; i <= 4; i++) {
            if (room.slots[i]?.peerId === effectivePeerId) {
              room.slots[i] = null;
              releasedSlot = i;
            }
          }
        }

        if (releasedSlot > 0) {
          broadcastToRoom(room, {
            type: "slot-state",
            slots: room.slots,
          });

          broadcastToRoom(room, {
            type: "chat",
            id: crypto.randomUUID(),
            senderId: "system",
            senderName: "SYSTEM",
            text: `👁️ ${effectivePlayerName} released Player ${releasedSlot} controller (now spectating)`,
            timestamp: Date.now(),
            isSystem: true,
          });
        }

        return;
      }


      if (type === "chat") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const text = (msg.text as string)?.trim();
        if (!sessionCode || !text || !myPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        const chatMsg = {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: myPeerId,
          senderName: myPlayerName,
          text,
          timestamp: Date.now(),
          isSystem: false,
        };

        broadcastToRoom(room, chatMsg);
        return;
      }

      if (type === "rom-change") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const romName = msg.romName as string;
        if (!sessionCode || !romName || myPeerId !== rooms.get(sessionCode)?.hostPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        room.romName = romName;

        broadcastToRoom(room, {
          type: "rom-info",
          romName,
        });

        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `🕹️ Host loaded game: ${romName}`,
          timestamp: Date.now(),
          isSystem: true,
        });
        return;
      }

      if (type === "leave") {
        handlePeerDisconnect();
        return;
      }
    });

    function handlePeerDisconnect() {
      if (!myPeerId || !mySessionCode) return;

      const room = rooms.get(mySessionCode);
      if (!room) return;

      room.peers.delete(myPeerId);

      // Release any slots held by this peer
      let heldSlot = 0;
      for (let i = 1; i <= 4; i++) {
        if (room.slots[i]?.peerId === myPeerId) {
          room.slots[i] = null;
          heldSlot = i;
        }
      }

      if (room.hostPeerId === myPeerId) {
        room.hostPeerId = null;
      }

      broadcastToRoom(room, {
        type: "peer-left",
        peerId: myPeerId,
        playerName: myPlayerName,
      });

      if (heldSlot > 0) {
        broadcastToRoom(room, {
          type: "slot-state",
          slots: room.slots,
        });
      }

      broadcastToRoom(room, {
        type: "chat",
        id: crypto.randomUUID(),
        senderId: "system",
        senderName: "SYSTEM",
        text: `👋 ${myPlayerName} left the room`,
        timestamp: Date.now(),
        isSystem: true,
      });

      if (room.peers.size === 0) {
        rooms.delete(mySessionCode);
      }

      logger.info({ sessionCode: mySessionCode, peerId: myPeerId, playerName: myPlayerName }, "Peer disconnected");
      myPeerId = null;
      mySessionCode = null;
    }

    ws.on("close", handlePeerDisconnect);

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket error");
    });
  });

  logger.info("WebSocket signaling server attached at /ws with multi-player slots & chat support");
}

