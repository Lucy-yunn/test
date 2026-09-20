import { PrismaClient } from "@prisma/client";

/**
 * Test support: counts the SQL statements a function really sends to the database.
 *
 * It uses a dedicated client with query logging, so nested `select`s that Prisma splits
 * into several statements are counted honestly, one per round trip. Only the integration
 * tests import this; the app never does. The client connects to `DATABASE_URL`, which
 * `vitest.integration.setup.ts` has already pointed at the local `ivo_test` database.
 */
export async function countQueries<T>(
  run: (db: PrismaClient) => Promise<T>,
): Promise<{ result: T; statements: number; sql: string[] }> {
  const counted = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: [{ emit: "event", level: "query" }],
  });
  const sql: string[] = [];
  counted.$on("query", (e) => {
    sql.push(e.query);
  });

  try {
    await counted.$queryRaw`SELECT 1`; // open the connection first, so it is not counted
    sql.length = 0;
    const result = await run(counted);
    return { result, statements: sql.length, sql: [...sql] };
  } finally {
    await counted.$disconnect();
  }
}
