import { db } from "@/lib/db";

/**
 * Health check (ADR-0001 §Route Handlers — the only Route Handler in v1 besides auth).
 * Verifies the process is up and the database is reachable.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch {
    return Response.json({ status: "ok", db: "unreachable" }, { status: 503 });
  }
}
