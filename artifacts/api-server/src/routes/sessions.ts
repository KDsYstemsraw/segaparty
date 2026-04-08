import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  JoinSessionParams,
  JoinSessionBody,
  LeaveSessionParams,
  LeaveSessionBody,
} from "@workspace/api-zod";

const router = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return crypto.randomUUID();
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
    const existing = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));
    if (existing.length === 0) break;
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

  await db.insert(sessionsTable).values({
    code,
    hostId: playerId,
    players,
    maxPlayers,
  });

  const session = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));

  const s = session[0];
  res.status(201).json({
    code: s.code,
    hostId: s.hostId,
    players: s.players,
    maxPlayers: s.maxPlayers,
    createdAt: s.createdAt.toISOString(),
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

  const { code } = parsed.data;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));

  if (sessions.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const s = sessions[0];
  res.json({
    code: s.code,
    hostId: s.hostId,
    players: s.players,
    maxPlayers: s.maxPlayers,
    createdAt: s.createdAt.toISOString(),
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

  const { code } = paramsParsed.data;
  const { playerName } = bodyParsed.data;

  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));
  if (sessions.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const session = sessions[0];
  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number }>;

  if (players.length >= session.maxPlayers) {
    res.status(400).json({ error: "Session is full" });
    return;
  }

  const playerId = generatePlayerId();
  const playerIndex = players.length + 1;

  const updatedPlayers = [
    ...players,
    {
      id: playerId,
      name: playerName,
      isHost: false,
      playerIndex,
    },
  ];

  await db.update(sessionsTable).set({ players: updatedPlayers }).where(eq(sessionsTable.code, code));

  const updated = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));
  const s = updated[0];

  res.json({
    session: {
      code: s.code,
      hostId: s.hostId,
      players: s.players,
      maxPlayers: s.maxPlayers,
      createdAt: s.createdAt.toISOString(),
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

  const { code } = paramsParsed.data;
  const { playerId } = bodyParsed.data;

  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.code, code));
  if (sessions.length === 0) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const session = sessions[0];
  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number }>;
  const updatedPlayers = players.filter((p) => p.id !== playerId);

  // If host left or no players, delete session
  if (playerId === session.hostId || updatedPlayers.length === 0) {
    await db.delete(sessionsTable).where(eq(sessionsTable.code, code));
  } else {
    await db.update(sessionsTable).set({ players: updatedPlayers }).where(eq(sessionsTable.code, code));
  }

  res.json({ success: true });
});

export default router;
