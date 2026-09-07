import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../auth";
import { db } from "../db";
import type { Actor, Role } from "./actor";
import { checkRole } from "./guards";

/**
 * The Next-coupled entry to the DAL (ADR-0001, docs/auth-and-permissions.md §10).
 * `proxy.ts` does only an optimistic cookie redirect — these run on every
 * authenticated read path AND must be re-called inside every Server Action.
 * Never call them from a layout (layouts don't re-run on navigation).
 *
 * Everything testable lives in the node-safe siblings (guards, invariants,
 * transitions, part-number); this file is thin glue over Better Auth + Prisma.
 */

/** Resolve the caller to an Actor. Memoised per request. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const row = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      messagingBlockedAt: true,
      buyer: { select: { id: true } },
      seller: { select: { id: true } },
    },
  });
  if (!row) return null;

  return {
    userId: row.id,
    role: row.role as Role,
    buyerId: row.buyer?.id ?? null,
    sellerId: row.seller?.id ?? null,
    messagingBlocked: row.messagingBlockedAt !== null,
  };
});

/** Actor or bust: an unauthenticated caller on a protected path → /login. */
export const verifySession = cache(async (): Promise<Actor> => {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
});

async function require(role: Role): Promise<Actor> {
  const actor = await getActor();
  const outcome = checkRole(actor, role);
  if (outcome === "login") redirect("/login");
  if (outcome === "forbidden") redirect("/forbidden");
  return actor as Actor;
}

export const requireBuyer = cache(() => require("buyer"));
export const requireSeller = cache(() => require("seller"));
export const requireStaff = cache(() => require("staff"));
