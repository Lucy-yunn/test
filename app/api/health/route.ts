import { db } from "@/lib/db";

/**
 * Health check (ADR-0001 §Route Handlers — the only Route Handler in v1 besides auth).
 * Verifies the process is up and the database is reachable.
 *
 * On failure it names the error class (never the connection string) so a broken
 * DATABASE_URL is diagnosable without turning on query logging.
 */
export const dynamic = "force-dynamic";

const redact = (s: string) =>
  s.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://<redacted>");

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.error(
      `[health] database check failed: ${e.name ?? "Error"} — ${redact(e.message ?? "")}`,
    );
    return Response.json(
      { status: "ok", db: "unreachable", error: e.name ?? "Error" },
      { status: 503 },
    );
  }
}
