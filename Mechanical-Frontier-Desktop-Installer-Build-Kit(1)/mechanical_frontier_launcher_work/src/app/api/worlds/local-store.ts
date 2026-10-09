import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type StoredWorld = Record<string, unknown> & {
  id: string;
  updatedAt: string;
  createdAt: string;
};

function getStorePath() {
  const dataDirectory = process.env.MECHANICAL_FRONTIER_DATA_DIR
    ? join(process.env.MECHANICAL_FRONTIER_DATA_DIR)
    : join(process.cwd(), ".mechanical-frontier");
  return { dataDirectory, storePath: join(dataDirectory, "worlds.json") };
}

async function readWorlds(): Promise<StoredWorld[]> {
  const { storePath } = getStorePath();
  try {
    const parsed: unknown = JSON.parse(await readFile(storePath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredWorld =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).id === "string" &&
        typeof (item as Record<string, unknown>).updatedAt === "string",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeWorlds(worlds: StoredWorld[]) {
  const { dataDirectory, storePath } = getStorePath();
  await mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(worlds, null, 2)}\n`, "utf8");
  await rename(temporaryPath, storePath);
}

export async function listLocalWorlds() {
  return (await readWorlds())
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 30);
}

export async function upsertLocalWorld(input: Record<string, unknown>) {
  const id = String(input.id);
  const worlds = await readWorlds();
  const existing = worlds.find((world) => world.id === id);
  const now = new Date().toISOString();
  const updatedAt = input.updatedAt instanceof Date
    ? input.updatedAt.toISOString()
    : typeof input.updatedAt === "string"
      ? input.updatedAt
      : now;
  const createdAt = existing?.createdAt ?? (
    input.createdAt instanceof Date
      ? input.createdAt.toISOString()
      : typeof input.createdAt === "string"
        ? input.createdAt
        : now
  );
  const world = { ...input, id, updatedAt, createdAt } as StoredWorld;
  await writeWorlds([world, ...worlds.filter((item) => item.id !== id)]);
  return world;
}

export async function deleteLocalWorld(id: string) {
  const worlds = await readWorlds();
  const next = worlds.filter((world) => world.id !== id);
  await writeWorlds(next);
  return next.length !== worlds.length;
}
