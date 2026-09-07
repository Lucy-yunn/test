import type { PrismaClient } from "@prisma/client";

/**
 * Readable staff codes — `PRT-000123` / `LST-000123` / `ORD-000123`
 * (docs/domain-model.md). Node-safe.
 *
 * The numeric suffix is zero-padded to 6, so `internalCode` sorts lexically ==
 * numerically. We take `max + 1`; the caller retries on a unique-constraint race
 * (v1 volume makes a contention loop cheap and a DB sequence unnecessary).
 */
export type CodePrefix = "PRT" | "LST" | "ORD";

const format = (prefix: CodePrefix, n: number) =>
  `${prefix}-${String(n).padStart(6, "0")}`;

export function parseCodeNumber(code: string): number {
  const m = /-(\d+)$/.exec(code);
  return m ? Number(m[1]) : 0;
}

export async function nextInternalCode(
  db: PrismaClient,
  prefix: CodePrefix,
): Promise<string> {
  const q = {
    where: { internalCode: { startsWith: `${prefix}-` } },
    orderBy: { internalCode: "desc" as const },
    select: { internalCode: true },
  };
  const latest =
    prefix === "PRT"
      ? await db.part.findFirst(q)
      : prefix === "LST"
        ? await db.listing.findFirst(q)
        : await db.order.findFirst(q);
  return format(prefix, parseCodeNumber(latest?.internalCode ?? "") + 1);
}
