import { timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { sweepOverdueCancellations } from "./orders";

/**
 * The daily Vercel Cron job that approves cancellation requests older than 7 days
 * (docs/order-model.md section 6.5). Node-safe: the route handler only passes the request
 * header and the configured secret in.
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`. With no secret configured the
 * endpoint refuses everything, so a forgotten setting can never leave it open.
 */
export type CancellationSweepResult = { status: 200; approved: number } | { status: 401 };

function isAuthorised(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function runCancellationSweep(
  db: PrismaClient,
  request: { authorization: string | null; secret: string | undefined },
  now: Date = new Date(),
): Promise<CancellationSweepResult> {
  if (!isAuthorised(request.authorization, request.secret)) return { status: 401 };
  return { status: 200, approved: await sweepOverdueCancellations(db, now) };
}
