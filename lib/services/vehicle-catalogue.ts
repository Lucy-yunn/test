import type { PrismaClient } from "@prisma/client";
import { ConflictError, NotFoundError } from "../dal/errors";
import { slugify } from "./slug";

/**
 * Minimal admin CRUD over the vehicle catalogue (docs/spec/admin-tool.md §4).
 * The repo seed fixture is the source of truth; this exists mainly to add a
 * `VehicleGeneration` during intake when a donor is "— NOT LISTED —". Node-safe.
 *
 * Slugs are immutable — derived once here, never changed by an edit.
 */

export async function addMake(
  db: PrismaClient,
  input: { name: string; country?: string | null; slug?: string; displayOrder?: number },
): Promise<{ id: string }> {
  return create(db, "vehicleMake", {
    name: input.name.trim(),
    slug: input.slug?.trim() || slugify(input.name),
    country: input.country?.trim() || null,
    displayOrder: input.displayOrder ?? 0,
  });
}

export async function addModelGroup(
  db: PrismaClient,
  input: { makeId: string; name: string; slug?: string; displayOrder?: number },
): Promise<{ id: string }> {
  await mustExist(db.vehicleMake.findUnique({ where: { id: input.makeId } }), "Make");
  return create(db, "vehicleModelGroup", {
    makeId: input.makeId,
    name: input.name.trim(),
    slug: input.slug?.trim() || slugify(input.name),
    displayOrder: input.displayOrder ?? 0,
  });
}

export async function addGeneration(
  db: PrismaClient,
  input: {
    modelGroupId: string;
    label: string;
    chassisCodes?: string[];
    productionStart?: number | null;
    productionEnd?: number | null;
    slug?: string;
    displayOrder?: number;
  },
): Promise<{ id: string }> {
  await mustExist(
    db.vehicleModelGroup.findUnique({ where: { id: input.modelGroupId } }),
    "Model group",
  );
  return create(db, "vehicleGeneration", {
    modelGroupId: input.modelGroupId,
    label: input.label.trim(),
    slug: input.slug?.trim() || slugify(input.label),
    chassisCodes: (input.chassisCodes ?? []).map((c) => c.trim()).filter(Boolean),
    productionStart: input.productionStart ?? null,
    productionEnd: input.productionEnd ?? null,
    displayOrder: input.displayOrder ?? 0,
  });
}

export type CatalogueModel =
  | "vehicleMake"
  | "vehicleModelGroup"
  | "vehicleGeneration";

/** Hide a row from the funnel without deleting (provenance may point at it). */
export async function setCatalogueRowActive(
  db: PrismaClient,
  model: CatalogueModel,
  id: string,
  isActive: boolean,
): Promise<void> {
  const data = { isActive };
  if (model === "vehicleMake") await db.vehicleMake.update({ where: { id }, data });
  else if (model === "vehicleModelGroup") await db.vehicleModelGroup.update({ where: { id }, data });
  else await db.vehicleGeneration.update({ where: { id }, data });
}

/** Rename (label/name/country only — never the slug). */
export async function renameCatalogueRow(
  db: PrismaClient,
  model: CatalogueModel,
  id: string,
  patch: { name?: string; label?: string; country?: string | null; displayOrder?: number },
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.label !== undefined) data.label = patch.label.trim();
  if (patch.country !== undefined) data.country = patch.country?.trim() || null;
  if (patch.displayOrder !== undefined) data.displayOrder = patch.displayOrder;
  if (model === "vehicleMake") await db.vehicleMake.update({ where: { id }, data });
  else if (model === "vehicleModelGroup") await db.vehicleModelGroup.update({ where: { id }, data });
  else await db.vehicleGeneration.update({ where: { id }, data });
}

async function create(
  db: PrismaClient,
  model: CatalogueModel,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  if (!data.slug) throw new ConflictError("Could not derive a slug from the name");
  try {
    if (model === "vehicleMake") {
      return await db.vehicleMake.create({ data: data as never, select: { id: true } });
    }
    if (model === "vehicleModelGroup") {
      return await db.vehicleModelGroup.create({ data: data as never, select: { id: true } });
    }
    return await db.vehicleGeneration.create({ data: data as never, select: { id: true } });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError(`A row with slug "${String(data.slug)}" already exists`);
    }
    throw err;
  }
}

async function mustExist<T>(p: Promise<T | null>, label: string): Promise<T> {
  const row = await p;
  if (!row) throw new NotFoundError(`${label} not found`);
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
