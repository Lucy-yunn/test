import { PrismaClient } from "@prisma/client";
import { assertPostgresUrl } from "./connection-string";

/**
 * Single Prisma client for the app runtime.
 *
 * `datasourceUrl` is passed explicitly and validated first, so:
 *  - there is no ambiguity about which env var / file the connection came from;
 *  - a malformed value (e.g. a string pasted twice) throws a clear error here
 *    instead of silently "working" or surfacing later as "db unreachable".
 *
 * In serverless (Vercel + Neon) `DATABASE_URL` must be the Neon pooler host
 * (ADR-0001). The global cache stops Next's dev HMR opening a new pool per reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const datasourceUrl = assertPostgresUrl("DATABASE_URL", process.env.DATABASE_URL);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ datasourceUrl, log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
