import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playerSchema = z.object({
  id: z.string(),
  name: z.string(),
  isHost: z.boolean(),
  playerIndex: z.number(),
});

export const sessionsTable = pgTable("sessions", {
  code: text("code").primaryKey(),
  hostId: text("host_id").notNull(),
  players: jsonb("players").notNull().$type<z.infer<typeof playerSchema>[]>(),
  maxPlayers: integer("max_players").notNull().default(4),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  createdAt: true,
});

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Player = z.infer<typeof playerSchema>;
