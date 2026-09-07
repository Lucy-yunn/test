import { db } from "@/lib/db";

/**
 * Health check (ADR-0001 §Route Handlers — the only Route Handler in v1 besides auth).
 *
 * Neon's compute scales to zero after ~5 min idle, so the first query after a
 * quiet spell can fail while the endpoint wakes (~1–3s). Retry briefly before
 * reporting the database down. On failure the error class is named (never the
 * connection string) so a genuinely broken DATABASE_URL stays diagnosable.
 */
export const dynamic = "force-dynamic";

const redact = (s: string) =>
  s.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://<redacted>");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET() {
  let lastError: unknown;
  for (const delayMs of [0, 750, 2000]) {
    if (delayMs) await sleep(delayMs);
    try {
      await db.$queryRaw`SELECT 1`;
      return Response.json({ status: "ok", db: "ok" });
    } catch (err) {
      lastError = err;
    }
  }

  const e = lastError as { name?: string; message?: string };
  console.error(
    `[health] database unreachable after retries: ${e.name ?? "Error"} — ${redact(e.message ?? "")}`,
  );
  return Response.json(
    { status: "ok", db: "unreachable", error: e.name ?? "Error" },
    { status: 503 },
  );
}
