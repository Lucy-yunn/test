import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

/**
 * Smoke test — proves the integration suite is wired to a reachable database
 * (the Neon `test` branch, via vitest.integration.setup.ts) and that it is NOT
 * the development database.
 */
const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("integration database", () => {
  it("is reachable", async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it("is the test branch, not development", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  });
});
