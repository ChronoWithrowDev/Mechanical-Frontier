export const dynamic = "force-dynamic";

export async function GET() {
  // A local installation deliberately works without PostgreSQL. When a hosted
  // DATABASE_URL is configured, continue checking that the database responds.
  if (!process.env.DATABASE_URL) {
    return Response.json({ ok: true, mode: "local" });
  }

  try {
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, mode: "database" });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
