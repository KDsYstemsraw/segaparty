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
  hostSecret: string | null;
  romName: string | null;
  core: string | null;
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
      hostSecret: null,
      romName: null,
      core: null,
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

function cleanupStaleSlots(room: RoomState) {
  for (const s of [1, 2, 3, 4]) {
    const occupant = room.slots[s];
    if (occupant) {
      const peer = room.peers.get(occupant.peerId);
      if (!peer || peer.ws.readyState !== WebSocket.OPEN) {
        room.slots[s] = null;
      }
    }
  }
}

function broadcastSlotState(room: RoomState) {
  broadcastToRoom(room, {
    type: "slot-state",
    slots: room.slots,
  });
}

export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 4 * 1024 * 1024, // 4 MB transport-level ceiling
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    let myPeerId: string | null = null;
    let mySessionCode: string | null = null;
    let myPlayerName = "Anonymous";

    // Per-connection rate limiting
    let messageCount = 0;
    let lastRateLimitWindow = Date.now();

    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on("pong", () => {
      (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    });

    ws.on("message", (rawData) => {
      // 1. Raw size check
      const rawLen = Buffer.isBuffer(rawData)
        ? rawData.length
        : Array.isArray(rawData)
        ? rawData.reduce((acc, b) => acc + b.length, 0)
        : rawData instanceof ArrayBuffer
        ? rawData.byteLength
        : Buffer.byteLength(String(rawData));
      if (rawLen > 4 * 1024 * 1024) {
        logger.warn({ peerId: myPeerId }, "Dropped oversized WebSocket message (> 4MB)");
        return;
      }

      // 2. Per-connection rate limiting (max 150 messages/sec)
      const now = Date.now();
      if (now - lastRateLimitWindow > 1000) {
        messageCount = 0;
        lastRateLimitWindow = now;
      }
      messageCount++;
      if (messageCount > 150) {
        logger.warn({ peerId: myPeerId }, "WebSocket message rate limit exceeded (150/s)");
        return;
      }

      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = msg.type as string;

      if (type === "join") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        let role = msg.role as "host" | "guest";
        const peerId = msg.peerId as string;
        const playerName = (msg.playerName as string) || (role === "host" ? "Host" : "Guest");
        const romName = msg.romName as string | undefined;
        const hostSecret = (msg.hostSecret as string) || (msg.hostToken as string) || (msg.playerId as string);

        if (!sessionCode || !peerId || !role) return;

        // Session code validation
        if (!/^[A-Z0-9]{4,12}$/.test(sessionCode)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid session code format" }));
          return;
        }

        const room = getOrCreateRoom(sessionCode);
        if (romName) room.romName = romName;
        if (msg.core) room.core = msg.core as string;

        cleanupStaleSlots(room);

        // SEC-02: Host verification & takeover protection
        if (role === "host") {
          if (!room.hostSecret) {
            // First host registration: establish secret for this room
            room.hostSecret = hostSecret || peerId;
          } else if (hostSecret && hostSecret === room.hostSecret) {
            // Legitimate host reconnecting with valid secret
            room.hostPeerId = peerId;
          } else {
            // Unauthorized client attempted role: "host" without the secret!
            logger.warn({ sessionCode, peerId, playerName }, "Unauthorized host usurpation attempt rejected; downgrading to guest");
            role = "guest";
          }
        }

        myPeerId = peerId;
        mySessionCode = sessionCode;
        myPlayerName = playerName;

        if (role === "host") {
          room.hostPeerId = peerId;
          // Auto-assign host to Slot 1 if empty or update peerId if host reconnected
          if (!room.slots[1] || room.slots[1].isHost || room.slots[1].playerName === playerName) {
            room.slots[1] = { peerId, playerName, isHost: true };
          }
          // Clear any other slot (2, 3, 4) that happens to have peerId
          for (const s of [2, 3, 4]) {
            if (room.slots[s]?.peerId === peerId) {
              room.slots[s] = null;
            }
          }
        } else if (role === "guest") {
          const hasSlot = Object.values(room.slots).some((s) => s?.peerId === peerId);
          if (!hasSlot) {
            const matchSlot = [2, 3, 4].find(
              (s) => room.slots[s]?.playerName === playerName && !room.slots[s]?.isHost
            );
            if (matchSlot) {
              room.slots[matchSlot] = { peerId, playerName, isHost: false };
            } else {
              // QA-03: Guests must NEVER be auto-assigned to Slot 1! Only pick from [2, 3, 4]
              const freeSlot = [2, 3, 4].find((s) => !room.slots[s]);
              if (freeSlot !== undefined) {
                room.slots[freeSlot] = { peerId, playerName, isHost: false };
              }
            }
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
            core: room.core,
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

      if (type === "slot-claim" || type === "claim-slot") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot); // 1, 2, 3, 4
        // SEC-06: Bind strictly to the socket's authenticated peerId; do NOT allow client-supplied peerId
        const effectivePeerId = myPeerId;
        const effectivePlayerName = myPlayerName || "Player";

        if (!sessionCode || slot < 1 || slot > 4 || !effectivePeerId) return;

        const room = getOrCreateRoom(sessionCode);
        cleanupStaleSlots(room);

        // QA-03 / SEC-02: Slot 1 is reserved exclusively for the room host!
        if (slot === 1 && effectivePeerId !== room.hostPeerId) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Player 1 controller is reserved exclusively for the room host.",
            }),
          );
          return;
        }

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
        // SEC-06: Bind strictly to the socket's authenticated peerId
        const effectivePeerId = myPeerId;
        const effectivePlayerName = myPlayerName || "Player";

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

      if (type === "slot-pass") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot);
        const targetPeerId = msg.targetPeerId as string;
        const targetPlayerName = (msg.targetPlayerName as string) || "Player";

        if (!sessionCode || !slot || slot < 1 || slot > 4 || !targetPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        cleanupStaleSlots(room);

        // Verify permission: host OR current occupant of this slot
        if (myPeerId !== room.hostPeerId && room.slots[slot]?.peerId !== myPeerId) return;

        // QA-03 / SEC-02: Slot 1 is reserved exclusively for the host
        if (slot === 1 && targetPeerId !== room.hostPeerId) {
          return;
        }

        // Clear any other slot targetPeerId held previously
        for (let i = 1; i <= 4; i++) {
          if (i !== slot && room.slots[i]?.peerId === targetPeerId) {
            room.slots[i] = null;
          }
        }

        room.slots[slot] = {
          peerId: targetPeerId,
          playerName: targetPlayerName,
          isHost: targetPeerId === room.hostPeerId,
        };

        broadcastToRoom(room, {
          type: "slot-state",
          slots: room.slots,
        });

        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `🎮 ${myPlayerName} passed Player ${slot} controller to ${targetPlayerName}`,
          timestamp: Date.now(),
          isSystem: true,
        });

        return;
      }

      if (type === "slot-kick") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot);

        if (!sessionCode || !slot || slot < 1 || slot > 4) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        cleanupStaleSlots(room);

        // Verify permission: only host
        if (myPeerId !== room.hostPeerId) return;

        const previousName = room.slots[slot]?.playerName || `Player ${slot}`;
        room.slots[slot] = null;

        broadcastToRoom(room, {
          type: "slot-state",
          slots: room.slots,
        });

        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `👑 Host released Player ${slot} controller (${previousName} is now spectating)`,
          timestamp: Date.now(),
          isSystem: true,
        });

        return;
      }

      if (type === "slot-request") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const slot = Number(msg.slot);

        if (!sessionCode || !slot || slot < 1 || slot > 4) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        broadcastToRoom(room, {
          type: "slot-request",
          fromPeerId: myPeerId,
          fromPlayerName: myPlayerName,
          slot,
        });

        broadcastToRoom(room, {
          type: "chat",
          id: crypto.randomUUID(),
          senderId: "system",
          senderName: "SYSTEM",
          text: `✋ ${myPlayerName} requested Player ${slot} controller`,
          timestamp: Date.now(),
          isSystem: true,
        });

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

      if (type === "rom-change" || type === "rom-info") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        if (!sessionCode || myPeerId !== rooms.get(sessionCode)?.hostPeerId) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        room.romName = (msg.romName as string) || null;
        room.core = (msg.core as string) || null;

        broadcastToRoom(room, {
          type: "rom-change",
          romName: room.romName,
          core: room.core,
        });

        broadcastToRoom(room, {
          type: "rom-info",
          romName: room.romName,
          core: room.core,
        });

        if (room.romName) {
          broadcastToRoom(room, {
            type: "chat",
            id: crypto.randomUUID(),
            senderId: "system",
            senderName: "SYSTEM",
            text: `🕹️ Host loaded game: ${room.romName}`,
            timestamp: Date.now(),
            isSystem: true,
          });
        }
        return;
      }

      if (type === "player-input") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        if (!sessionCode) return;

        const room = rooms.get(sessionCode);
        if (!room || !room.hostPeerId || !myPeerId) return;

        cleanupStaleSlots(room);

        let ownedSlot: number | undefined;
        for (const s of [1, 2, 3, 4]) {
          if (room.slots[s]?.peerId === myPeerId) {
            ownedSlot = s;
            break;
          }
        }

        if (!ownedSlot && myPeerId !== room.hostPeerId) {
          const peerInfo = room.peers.get(myPeerId);
          // QA-03: Auto-assign only from [2, 3, 4], NEVER Slot 1!
          let freeSlot = [2, 3, 4].find((s) => !room.slots[s]);
          if (!freeSlot && !room.slots[2]?.isHost) {
            freeSlot = 2;
          }
          if (freeSlot) {
            room.slots[freeSlot] = {
              peerId: myPeerId,
              playerName: peerInfo?.playerName || "Player 2",
              isHost: false,
            };
            ownedSlot = freeSlot;
            broadcastSlotState(room);
          }
        }

        // Slot 1 is host-only; guests can only use their owned slot (2, 3, 4)
        const effectivePlayerIndex = myPeerId === room.hostPeerId ? 1 : (ownedSlot || 2);
        if (effectivePlayerIndex === 1 && myPeerId !== room.hostPeerId) {
          return;
        }

        const rawInput = (msg.input && typeof msg.input === "object") ? (msg.input as Record<string, unknown>) : {};
        const sanitizedInput = {
          ...rawInput,
          playerIndex: effectivePlayerIndex,
        };

        const hostPeer = room.peers.get(room.hostPeerId);
        if (hostPeer && hostPeer.ws.readyState === WebSocket.OPEN) {
          hostPeer.ws.send(
            JSON.stringify({
              type: "player-input",
              fromPeerId: myPeerId,
              input: sanitizedInput,
            }),
          );
        }
        return;
      }

      if (type === "video-frame") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const frame = msg.frame as string;
        if (!sessionCode || !frame) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        // Security: only host may broadcast game stream frames
        if (myPeerId !== room.hostPeerId) return;

        // Size cap: max 2 MB per frame
        if (frame.length > 2 * 1024 * 1024) return;

        broadcastToRoom(
          room,
          {
            type: "video-frame",
            fromPeerId: myPeerId,
            frame,
            timestamp: (msg.timestamp as number) || Date.now(),
          },
          myPeerId || undefined,
        );
        return;
      }

      if (type === "audio-chunk") {
        const sessionCode = (msg.sessionCode as string)?.toUpperCase();
        const pcm = msg.pcm as string;
        const sampleRate = msg.sampleRate as number;
        if (!sessionCode || !pcm) return;

        const room = rooms.get(sessionCode);
        if (!room) return;

        // Security: only host may broadcast game audio chunks
        if (myPeerId !== room.hostPeerId) return;

        // Size cap: max 512 KB per audio chunk
        if (pcm.length > 512 * 1024) return;

        broadcastToRoom(
          room,
          {
            type: "audio-chunk",
            fromPeerId: myPeerId,
            pcm,
            sampleRate: sampleRate || 22050,
          },
          myPeerId || undefined,
        );
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
        broadcastToRoom(room, { type: "no-host" });
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

  // Ping/pong heartbeat to keep connections alive through reverse proxies
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  logger.info("WebSocket signaling server attached at /ws with multi-player slots & chat support");
}

