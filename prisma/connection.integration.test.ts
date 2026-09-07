import { describe, it, expect, afterAll } from "vitest";
import { db } from "../lib/db";

/**
 * Proves the REAL app runtime DB path works end to end against the Neon `test`
 * branch (via vitest.integration.setup.ts): the same `lib/db` client a route
 * handler uses, including the `assertPostgresUrl` guard and explicit
 * `datasourceUrl`.
 *
 * Regression for the "GET /api/health -> db: unreachable" report — a corrupted
 * DATABASE_URL (pasted twice) that `new URL()` still parsed.
 */
afterAll(async () => {
  await db.$disconnect();
});

describe("app runtime database path", () => {
  it("lib/db can run a query (what /api/health does)", async () => {
    const rows = await db.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it("is pointed at the test branch, not development", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  });

  it("DATABASE_URL is a single connection string", () => {
    const schemes = (process.env.DATABASE_URL?.match(/:\/\//g) ?? []).length;
    expect(schemes).toBe(1);
  });
});
