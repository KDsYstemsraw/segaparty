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

const router = Router();

// In-memory fallback session store when DATABASE_URL is not configured
const inMemorySessions = new Map<string, Session>();

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

async function findSession(code: string): Promise<Session | undefined> {
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

  res.json({
    code: session.code,
    hostId: session.hostId,
    players: session.players,
    maxPlayers: session.maxPlayers,
    createdAt: session.createdAt.toISOString(),
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

  if (hasDatabase && db) {
    await db.update(sessionsTable).set({ players: updatedPlayers }).where(eq(sessionsTable.code, code));
  } else {
    session.players = updatedPlayers;
    inMemorySessions.set(code, session);
  }

  res.json({
    session: {
      code: session.code,
      hostId: session.hostId,
      players: updatedPlayers,
      maxPlayers: session.maxPlayers,
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

  const session = await findSession(code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const players = session.players as Array<{ id: string; name: string; isHost: boolean; playerIndex: number }>;
  const updatedPlayers = players.filter((p) => p.id !== playerId);

  // If host left or no players, delete session
  if (playerId === session.hostId || updatedPlayers.length === 0) {
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

