import type { PrismaClient, Prisma } from "@prisma/client";
import { InvariantError, NotFoundError } from "./errors";

/**
 * Behavioural invariants that need the database. Node-safe (takes a Prisma client;
 * no `server-only`, no Next). Called by the service functions before a write,
 * inside the same transaction where relevant. Source: docs/domain-model.md §4.
 *
 * Structural invariants (FKs, leaf-only, uniqueness) are in the schema and are
 * NOT re-checked here.
 */

/** A Prisma client or an interactive-transaction client — both satisfy this. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * `Listing.sellerId == DonorVehicle.sellerId` — a listing's donor vehicle must
 * belong to the same seller. Enforced here because the FK alone can't express it.
 */
export async function assertSellerOwnsDonorVehicle(
  db: Db,
  args: { sellerId: string; donorVehicleId: string },
): Promise<void> {
  const donor = await db.donorVehicle.findUnique({
    where: { id: args.donorVehicleId },
    select: { sellerId: true },
  });
  if (!donor) {
    throw new NotFoundError(`DonorVehicle ${args.donorVehicleId} not found`);
  }
  if (donor.sellerId !== args.sellerId) {
    throw new InvariantError(
      `DonorVehicle ${args.donorVehicleId} belongs to another seller`,
    );
  }
}

/** "Cannot delete a Category that still has Parts." */
export async function assertCategoryHasNoParts(
  db: Db,
  categoryId: string,
): Promise<void> {
  const count = await db.part.count({ where: { categoryId } });
  if (count > 0) {
    throw new InvariantError(
      `Category ${categoryId} still classifies ${count} part(s)`,
    );
  }
}

export interface PartNumberConflict {
  partId: string;
  internalCode: string;
  raw: string;
  normalized: string;
}

/**
 * Intake de-dup: an exact `PartNumber.normalized` match surfaces the existing
 * Part so staff can attach to it instead of creating a duplicate. Conservative —
 * this only *reports*; it never auto-merges (research #5).
 */
export async function findConflictingPartNumber(
  db: Db,
  normalized: string,
  opts: { excludePartId?: string } = {},
): Promise<PartNumberConflict | null> {
  if (!normalized) return null;
  const row = await db.partNumber.findFirst({
    where: {
      normalized,
      ...(opts.excludePartId ? { partId: { not: opts.excludePartId } } : {}),
    },
    select: {
      raw: true,
      normalized: true,
      part: { select: { id: true, internalCode: true } },
    },
    orderBy: { part: { createdAt: "asc" } },
  });
  if (!row) return null;
  return {
    partId: row.part.id,
    internalCode: row.part.internalCode,
    raw: row.raw,
    normalized: row.normalized,
  };
}
