import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client. In dev, Next's HMR would otherwise open a new pool on
 * every reload; in serverless (Vercel + Neon) the connection string itself must
 * point at the Neon pooler (ADR-0001).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
