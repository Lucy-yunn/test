import type { PrismaClient, Prisma, NumberType } from "@prisma/client";
import { ConflictError, InvariantError, NotFoundError } from "../dal/errors";
import { assertTransition, PART_STATUS_TRANSITIONS } from "../dal/transitions";
import { normalizePartNumber } from "../dal/part-number";
import {
  findConflictingPartNumber,
  type PartNumberConflict,
} from "../dal/invariants";
import { validateAttributes } from "../dal/part-attributes";
import { nextInternalCode } from "./internal-code";

/**
 * Part & PartNumber operations for admin intake (docs/spec/admin-tool.md §5,
 * research #5). Node-safe. Hard-merge with tombstone + audit is a follow-up
 * (needs an AuditLog table); this covers CRUD, de-dup surfacing, and the
 * partStatus / pnStatus rules.
 */

type PnStatus = "unknown" | "unverified" | "verified";

/** `pnStatus` summarises the PartNumber rows. */
export function pnStatusFor(numbers: { verified: boolean }[]): PnStatus {
  if (numbers.length === 0) return "unknown";
  return numbers.some((n) => n.verified) ? "verified" : "unverified";
}

async function recomputePnStatus(db: PrismaClient, partId: string): Promise<void> {
  const numbers = await db.partNumber.findMany({
    where: { partId },
    select: { verified: true },
  });
  await db.part.update({
    where: { id: partId },
    data: { pnStatus: pnStatusFor(numbers) },
  });
}

export interface CreatePartInput {
  categoryId: string;
  name: string;
  attributes?: unknown;
  notes?: string | null;
  createdBy?: string | null;
}

export async function createPart(
  db: PrismaClient,
  input: CreatePartInput,
): Promise<{ id: string; internalCode: string }> {
  const category = await db.category.findUnique({
    where: { id: input.categoryId },
    select: { slug: true },
  });
  if (!category) throw new NotFoundError("Category not found");

  const attributes = validateAttributes(category.slug, input.attributes);

  for (let attempt = 0; attempt < 5; attempt++) {
    const internalCode = await nextInternalCode(db, "PRT");
    try {
      return await db.part.create({
        data: {
          internalCode,
          categoryId: input.categoryId,
          name: input.name.trim(),
          attributes: attributes as Prisma.InputJsonValue,
          notes: input.notes?.trim() || null,
          createdBy: input.createdBy ?? null,
        },
        select: { id: true, internalCode: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue; // lost the code race — retry
      throw err;
    }
  }
  throw new ConflictError("Could not allocate a Part code, try again");
}

export interface UpdatePartInput {
  name?: string;
  categoryId?: string;
  attributes?: unknown;
  notes?: string | null;
}

export async function updatePart(
  db: PrismaClient,
  partId: string,
  patch: UpdatePartInput,
): Promise<void> {
  const part = await db.part.findUnique({
    where: { id: partId },
    select: { categoryId: true },
  });
  if (!part) throw new NotFoundError("Part not found");

  const data: Prisma.PartUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;

  const categoryId = patch.categoryId ?? part.categoryId;
  if (patch.categoryId !== undefined) {
    const cat = await db.category.findUnique({
      where: { id: patch.categoryId },
      select: { id: true },
    });
    if (!cat) throw new NotFoundError("Category not found");
    data.category = { connect: { id: patch.categoryId } };
  }
  if (patch.attributes !== undefined || patch.categoryId !== undefined) {
    const cat = await db.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: { slug: true },
    });
    const raw =
      patch.attributes !== undefined
        ? patch.attributes
        : (await db.part.findUniqueOrThrow({ where: { id: partId }, select: { attributes: true } }))
            .attributes;
    data.attributes = validateAttributes(cat.slug, raw) as Prisma.InputJsonValue;
  }

  await db.part.update({ where: { id: partId }, data });
}

/** `provisional → confirmed`, staff-only, no going back. */
export async function setPartStatus(
  db: PrismaClient,
  partId: string,
  to: "provisional" | "confirmed",
): Promise<void> {
  const part = await db.part.findUnique({
    where: { id: partId },
    select: { partStatus: true },
  });
  if (!part) throw new NotFoundError("Part not found");
  assertTransition(PART_STATUS_TRANSITIONS, part.partStatus, to, "Part");
  await db.part.update({ where: { id: partId }, data: { partStatus: to } });
}

export interface AddPartNumberInput {
  partId: string;
  raw: string;
  numberType?: NumberType;
  brand?: string | null;
  isPrimary?: boolean;
  verified?: boolean;
}

/**
 * Adds a number. Returns the row plus any `conflict` — an existing Part that
 * already carries this normalized number (surfaced to staff; never auto-merged).
 */
export async function addPartNumber(
  db: PrismaClient,
  input: AddPartNumberInput,
): Promise<{ id: string; conflict: PartNumberConflict | null }> {
  const part = await db.part.findUnique({
    where: { id: input.partId },
    select: { id: true },
  });
  if (!part) throw new NotFoundError("Part not found");

  const normalized = normalizePartNumber(input.raw);
  if (!normalized) throw new InvariantError("Part number has no usable characters");

  const conflict = await findConflictingPartNumber(db, normalized, {
    excludePartId: input.partId,
  });

  const row = await db.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.partNumber.updateMany({
        where: { partId: input.partId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.partNumber.create({
      data: {
        partId: input.partId,
        raw: input.raw.trim(),
        normalized,
        numberType: input.numberType ?? "oem",
        brand: input.brand?.trim() || null,
        isPrimary: input.isPrimary ?? false,
        verified: input.verified ?? false,
      },
      select: { id: true },
    });
  });

  await recomputePnStatus(db, input.partId);
  return { id: row.id, conflict };
}

export async function updatePartNumber(
  db: PrismaClient,
  id: string,
  patch: { raw?: string; numberType?: NumberType; brand?: string | null; isPrimary?: boolean; verified?: boolean },
): Promise<void> {
  const existing = await db.partNumber.findUnique({
    where: { id },
    select: { partId: true },
  });
  if (!existing) throw new NotFoundError("Part number not found");

  await db.$transaction(async (tx) => {
    if (patch.isPrimary) {
      await tx.partNumber.updateMany({
        where: { partId: existing.partId, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }
    const data: Prisma.PartNumberUpdateInput = {};
    if (patch.raw !== undefined) {
      data.raw = patch.raw.trim();
      data.normalized = normalizePartNumber(patch.raw);
    }
    if (patch.numberType !== undefined) data.numberType = patch.numberType;
    if (patch.brand !== undefined) data.brand = patch.brand?.trim() || null;
    if (patch.isPrimary !== undefined) data.isPrimary = patch.isPrimary;
    if (patch.verified !== undefined) data.verified = patch.verified;
    await tx.partNumber.update({ where: { id }, data });
  });

  await recomputePnStatus(db, existing.partId);
}

export async function removePartNumber(db: PrismaClient, id: string): Promise<void> {
  const existing = await db.partNumber.findUnique({
    where: { id },
    select: { partId: true },
  });
  if (!existing) throw new NotFoundError("Part number not found");
  await db.partNumber.delete({ where: { id } });
  await recomputePnStatus(db, existing.partId);
}

/** De-dup check for the "new Part" flow — pass a raw number. */
export async function checkPartNumberConflict(
  db: PrismaClient,
  raw: string,
): Promise<PartNumberConflict | null> {
  return findConflictingPartNumber(db, normalizePartNumber(raw));
}

/** Search by internal code, name, or normalized part number. */
export async function searchParts(
  db: PrismaClient,
  query: string,
  limit = 25,
): Promise<
  { id: string; internalCode: string; name: string; partStatus: string; pnStatus: string }[]
> {
  const q = query.trim();
  const norm = normalizePartNumber(q);
  return db.part.findMany({
    where: q
      ? {
          OR: [
            { internalCode: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            ...(norm ? [{ partNumbers: { some: { normalized: { contains: norm } } } }] : []),
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      internalCode: true,
      name: true,
      partStatus: true,
      pnStatus: true,
    },
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
