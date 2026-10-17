import { Router } from "express";
import { db, hasDatabase, sessionsTable, type Session } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  JoinSessionParams,
  JoinSessionBody,
  LeaveSessionParams,
  LeaveSessionBody,
} from "@workspace/api-zod";

import crypto from "node:crypto";

const router = Router();

// In-memory fallback session store when DATABASE_URL is not configured
const inMemorySessions = new Map<string, Session>();

function generateCode(): string {
  // Alphanumeric uppercase without ambiguous characters (no 0, O, I, 1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(0, chars.length);
    code += chars[idx];
  }
  return code;
}

function generatePlayerId(): string {
  return crypto.randomUUID();
}

export async function findSession(code: string): Promise<Session | undefined> {
  const upperCode = code.toUpperCase();
  if (hasDatabase && db) {
    const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.code, upperCode));
    return sessions[0];
  }
  return inMemorySessions.get(upperCode);
}

// Create session
router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { hostName, maxPlayers = 4 } = parsed.data;
  const playerId = generatePlayerId();
  let code: string;

  // generate unique code
  let attempts = 0;
  do {
    code = generateCode();
    const existing = await findSession(code);
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  const players = [
    {
      id: playerId,
      name: hostName,
      isHost: true,
      playerIndex: 1,
    },
  ];

  const newSession: Session = {
    code,
    hostId: playerId,
    players,
    maxPlayers,
    createdAt: new Date(),
  };

  if (hasDatabase && db) {
    await db.insert(sessionsTable).values({
      code,
      hostId: playerId,
      players,
      maxPlayers,
    });
  } else {
    inMemorySessions.set(code, newSession);
  }

  res.status(201).json({
    code: newSession.code,
    hostId: newSession.hostId,
    players: newSession.players,
    maxPlayers: newSession.maxPlayers,
    createdAt: newSession.createdAt.toISOString(),
    playerId,
  });
});

// Get session by code
router.get("/sessions/:code", async (req, res) => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request params" });
    return;
  }

  const code = parsed.data.code.toUpperCase();
  const session = await findSession(code);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const callerPlayerId = (req.headers["x-player-id"] || req.headers["x-host-secret"] || req.query.playerId) as string | undefined;
  const isCallerHost = Boolean(callerPlayerId && callerPlayerId === session.hostId);

  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number; slot?: number }>;
  const sanitizedPlayers = players.map((p) => ({
    name: p.name,
    slot: p.slot ?? p.playerIndex,
    playerIndex: p.playerIndex ?? p.slot ?? 1,
    isHost: Boolean(p.isHost),
    ...(callerPlayerId && p.id === callerPlayerId ? { id: p.id } : {}),
  }));

  res.json({
    code: session.code,
    players: sanitizedPlayers,
    maxPlayers: session.maxPlayers,
    createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : String(session.createdAt),
    isHost: isCallerHost,
    ...(isCallerHost ? { hostId: session.hostId } : {}),
  });
});

// Join session
router.post("/sessions/:code/join", async (req, res) => {
  const paramsParsed = JoinSessionParams.safeParse(req.params);
  const bodyParsed = JoinSessionBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const code = paramsParsed.data.code.toUpperCase();
  const { playerName } = bodyParsed.data;

  const session = await findSession(code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number }>;

  let finalPlayerName = playerName.trim();
  const nameExists = (n: string) =>
    players.some((p) => p.name.trim().toLowerCase() === n.trim().toLowerCase());

  // SEC-03: Prevent player ID leakage and host takeover via display name collision.
  // If a player with the same name already exists (or someone attempts to join with the host's name),
  // append a discriminator suffix (e.g. "Sonic (2)") so existing identities and host tokens are never stolen.
  if (nameExists(finalPlayerName)) {
    let suffix = 2;
    while (nameExists(`${finalPlayerName} (${suffix})`)) {
      suffix++;
    }
    finalPlayerName = `${finalPlayerName} (${suffix})`;
  }

  const playerId = generatePlayerId();
  const playerIndex = players.length < session.maxPlayers ? players.length + 1 : 0;
  const updatedMaxPlayers = Math.max(session.maxPlayers, players.length + 1);
  const updatedPlayers = [
    ...players,
    {
      id: playerId,
      name: finalPlayerName,
      isHost: false,
      playerIndex,
    },
  ];

  if (hasDatabase && db) {
    await db
      .update(sessionsTable)
      .set({ players: updatedPlayers, maxPlayers: updatedMaxPlayers })
      .where(eq(sessionsTable.code, code));
  } else {
    session.players = updatedPlayers;
    session.maxPlayers = updatedMaxPlayers;
    inMemorySessions.set(code, session);
  }

  res.json({
    session: {
      code: session.code,
      hostId: session.hostId,
      players: updatedPlayers,
      maxPlayers: updatedMaxPlayers,
      createdAt: session.createdAt.toISOString(),
    },
    playerId,
  });
});

// Leave session
router.post("/sessions/:code/leave", async (req, res) => {
  const paramsParsed = LeaveSessionParams.safeParse(req.params);
  const bodyParsed = LeaveSessionBody.safeParse(req.body);

  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const code = paramsParsed.data.code.toUpperCase();
  const { playerId } = bodyParsed.data;
  const hostSecretHeader = (req.headers["x-host-secret"] || req.headers["x-player-id"] || (req.body as Record<string, unknown>)?.hostSecret) as string | undefined;

  const session = await findSession(code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const isHostAttempt = playerId === session.hostId;
  const isHostAuthorized = isHostAttempt && Boolean(hostSecretHeader && hostSecretHeader === session.hostId);

  // SEC-12: If caller claims to be host or wants to terminate room, require hostSecret authorization!
  if (isHostAttempt && !isHostAuthorized) {
    res.status(403).json({ error: "Unauthorized: valid host secret is required to terminate session" });
    return;
  }

  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number }>;
  const updatedPlayers = players.filter((p) => p.id !== playerId);

  // If authorized host left or no players, delete session
  if ((isHostAttempt && isHostAuthorized) || updatedPlayers.length === 0) {
    if (hasDatabase && db) {
      await db.delete(sessionsTable).where(eq(sessionsTable.code, code));
    } else {
      inMemorySessions.delete(code);
    }
  } else {
    if (hasDatabase && db) {
      await db.update(sessionsTable).set({ players: updatedPlayers }).where(eq(sessionsTable.code, code));
    } else {
      session.players = updatedPlayers;
      inMemorySessions.set(code, session);
    }
  }

  res.json({ success: true });
});

export default router;

