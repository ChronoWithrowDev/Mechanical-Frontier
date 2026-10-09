import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const gameWorlds = pgTable("game_worlds", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  playerName: text("player_name").notNull(),
  region: text("region").notNull(),
  roomIndex: integer("room_index").notNull().default(0),
  playtimeSeconds: integer("playtime_seconds").notNull().default(0),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  inventory: jsonb("inventory").$type<string[]>().notNull(),
  discoveredRooms: jsonb("discovered_rooms").$type<number[]>().notNull(),
  collectedRooms: jsonb("collected_rooms").$type<number[]>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
