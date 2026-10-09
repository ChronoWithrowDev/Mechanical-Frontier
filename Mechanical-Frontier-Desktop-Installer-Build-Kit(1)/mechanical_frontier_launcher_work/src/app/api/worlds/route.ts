import { NextResponse } from "next/server";
import { deleteLocalWorld, listLocalWorlds, upsertLocalWorld } from "./local-store";

export const runtime = "nodejs";

const numberField = (value: unknown, fallback: number, min = 0, max = 2_000_000) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const stringList = (value: unknown, max = 120): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, max);
};

const numberList = (value: unknown, max = 100): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    .map((item) => Math.max(0, Math.min(99, Math.floor(item))))
    .slice(0, max);
};

export async function GET() {
  if (!process.env.DATABASE_URL) {
    try {
      return NextResponse.json({ worlds: await listLocalWorlds() });
    } catch (error) {
      console.error("Unable to load local world files:", error);
      return NextResponse.json({ error: "The local world archive could not be read." }, { status: 500 });
    }
  }

  try {
    const { db } = await import("@/db");
    const { desc } = await import("drizzle-orm");
    const { gameWorlds } = await import("@/db/schema");
    const worlds = await db.select().from(gameWorlds).orderBy(desc(gameWorlds.updatedAt)).limit(30);
    return NextResponse.json({ worlds });
  } catch (error) {
    console.error("Unable to load world files:", error);
    return NextResponse.json({ error: "World archive is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "A world file is required." }, { status: 400 });
    }
    input = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "The world file could not be read." }, { status: 400 });
  }

  const id = typeof input.id === "string" ? input.id.trim().slice(0, 80) : "";
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "A valid world file ID is required." }, { status: 400 });
  }

  const now = new Date();
  const values = {
    id,
    title: (typeof input.title === "string" ? input.title.trim() : "") .slice(0, 60) || "Frontier journal",
    playerName: (typeof input.playerName === "string" ? input.playerName.trim() : "") .slice(0, 32) || "Ranger",
    region: (typeof input.region === "string" ? input.region.trim() : "") .slice(0, 100) || "Walsenburg, Colorado",
    roomIndex: numberField(input.roomIndex, 0, 0, 99),
    playtimeSeconds: numberField(input.playtimeSeconds, 0),
    level: numberField(input.level, 1, 1, 99),
    xp: numberField(input.xp, 0),
    inventory: stringList(input.inventory),
    discoveredRooms: numberList(input.discoveredRooms),
    collectedRooms: numberList(input.collectedRooms),
    updatedAt: now,
  };

  if (!process.env.DATABASE_URL) {
    try {
      const world = await upsertLocalWorld(values as unknown as Record<string, unknown>);
      return NextResponse.json({ world });
    } catch (error) {
      console.error("Unable to save local world file:", error);
      return NextResponse.json({ error: "The local world archive could not save this file." }, { status: 500 });
    }
  }

  try {
    const { db } = await import("@/db");
    const { gameWorlds } = await import("@/db/schema");
    const [world] = await db
      .insert(gameWorlds)
      .values(values)
      .onConflictDoUpdate({
        target: gameWorlds.id,
        set: {
          title: values.title,
          playerName: values.playerName,
          region: values.region,
          roomIndex: values.roomIndex,
          playtimeSeconds: values.playtimeSeconds,
          level: values.level,
          xp: values.xp,
          inventory: values.inventory,
          discoveredRooms: values.discoveredRooms,
          collectedRooms: values.collectedRooms,
          updatedAt: now,
        },
      })
      .returning();
    return NextResponse.json({ world });
  } catch (error) {
    console.error("Unable to save world file:", error);
    return NextResponse.json({ error: "The world archive could not save this file." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 80);
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "A valid world file ID is required." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    try {
      const deleted = await deleteLocalWorld(id);
      return NextResponse.json({ deleted, id });
    } catch (error) {
      console.error("Unable to delete local world file:", error);
      return NextResponse.json({ error: "The local world archive could not remove this file." }, { status: 500 });
    }
  }

  try {
    const { db } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { gameWorlds } = await import("@/db/schema");
    await db.delete(gameWorlds).where(eq(gameWorlds.id, id));
    return NextResponse.json({ deleted: true, id });
  } catch (error) {
    console.error("Unable to delete world file:", error);
    return NextResponse.json({ error: "The world archive could not remove this file." }, { status: 503 });
  }
}
