import type { PrismaClient, Prisma, Condition, ListingStatus } from "@prisma/client";
import { InvariantError, NotFoundError } from "../dal/errors";
import { assertTransition, LISTING_TRANSITIONS } from "../dal/transitions";
import { assertSellerOwnsDonorVehicle } from "../dal/invariants";
import { nextInternalCode } from "./internal-code";
import {
  evaluatePublishChecklist,
  type PublishChecklistResult,
} from "./publish-checklist";

/**
 * Listing intake (docs/spec/admin-tool.md §6.2, #8). Node-safe.
 *
 * Invariants enforced here: `Listing.sellerId == DonorVehicle.sellerId`
 * (via assertSellerOwnsDonorVehicle), the publish checklist as the ONLY
 * `draft → published` gate, and the staff-allowed status transitions
 * (never `reserved` / `sold` — those are order-driven).
 */

const clean = (s?: string | null) => s?.trim() || null;

export interface CreateListingInput {
  donorVehicleId: string;
  partId: string;
  priceEur: string; // decimal string
  condition: Condition;
  conditionNotes?: string | null;
  removalNotes?: string | null;
  negotiable?: boolean;
  sellerSku?: string | null;
  warehouseLocation?: string | null;
  lengthCm?: string | null;
  widthCm?: string | null;
  heightCm?: string | null;
  weightKg?: string | null;
  packageSizeNotes?: string | null;
  noVisiblePartNumber?: boolean;
}

export async function createListing(
  db: PrismaClient,
  input: CreateListingInput,
  createdBy?: string | null,
): Promise<{ id: string; internalCode: string }> {
  const donor = await db.donorVehicle.findUnique({
    where: { id: input.donorVehicleId },
    select: { sellerId: true },
  });
  if (!donor) throw new NotFoundError("Donor vehicle not found");

  const part = await db.part.findUnique({
    where: { id: input.partId },
    select: { id: true },
  });
  if (!part) throw new NotFoundError("Part not found");

  await assertSellerOwnsDonorVehicle(db, {
    sellerId: donor.sellerId,
    donorVehicleId: input.donorVehicleId,
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    const internalCode = await nextInternalCode(db, "LST");
    try {
      return await db.listing.create({
        data: {
          internalCode,
          partId: input.partId,
          sellerId: donor.sellerId,
          donorVehicleId: input.donorVehicleId,
          priceEur: input.priceEur,
          condition: input.condition,
          conditionNotes: clean(input.conditionNotes),
          removalNotes: clean(input.removalNotes),
          negotiable: input.negotiable ?? false,
          sellerSku: clean(input.sellerSku),
          warehouseLocation: clean(input.warehouseLocation),
          lengthCm: input.lengthCm ?? null,
          widthCm: input.widthCm ?? null,
          heightCm: input.heightCm ?? null,
          weightKg: input.weightKg ?? null,
          packageSizeNotes: clean(input.packageSizeNotes),
          noVisiblePartNumber: input.noVisiblePartNumber ?? false,
          createdBy: createdBy ?? null,
        },
        select: { id: true, internalCode: true },
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new InvariantError("Could not allocate a Listing code, try again");
}

export type UpdateListingInput = Partial<Omit<CreateListingInput, "donorVehicleId">>;

export async function updateListing(
  db: PrismaClient,
  listingId: string,
  patch: UpdateListingInput,
): Promise<void> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!listing) throw new NotFoundError("Listing not found");

  const data: Prisma.ListingUpdateInput = {};
  if (patch.partId !== undefined) {
    const part = await db.part.findUnique({ where: { id: patch.partId }, select: { id: true } });
    if (!part) throw new NotFoundError("Part not found");
    data.part = { connect: { id: patch.partId } };
  }
  if (patch.priceEur !== undefined) data.priceEur = patch.priceEur;
  if (patch.condition !== undefined) data.condition = patch.condition;
  if (patch.conditionNotes !== undefined) data.conditionNotes = clean(patch.conditionNotes);
  if (patch.removalNotes !== undefined) data.removalNotes = clean(patch.removalNotes);
  if (patch.negotiable !== undefined) data.negotiable = patch.negotiable;
  if (patch.sellerSku !== undefined) data.sellerSku = clean(patch.sellerSku);
  if (patch.warehouseLocation !== undefined) data.warehouseLocation = clean(patch.warehouseLocation);
  if (patch.lengthCm !== undefined) data.lengthCm = patch.lengthCm ?? null;
  if (patch.widthCm !== undefined) data.widthCm = patch.widthCm ?? null;
  if (patch.heightCm !== undefined) data.heightCm = patch.heightCm ?? null;
  if (patch.weightKg !== undefined) data.weightKg = patch.weightKg ?? null;
  if (patch.packageSizeNotes !== undefined) data.packageSizeNotes = clean(patch.packageSizeNotes);
  if (patch.noVisiblePartNumber !== undefined) data.noVisiblePartNumber = patch.noVisiblePartNumber;

  await db.listing.update({ where: { id: listingId }, data });
}

export async function addListingDefect(
  db: PrismaClient,
  listingId: string,
  description: string,
  photoId?: string | null,
): Promise<{ id: string }> {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true } });
  if (!listing) throw new NotFoundError("Listing not found");
  const count = await db.listingDefect.count({ where: { listingId } });
  return db.listingDefect.create({
    data: {
      listingId,
      description: description.trim(),
      photoId: photoId ?? null,
      displayOrder: count,
    },
    select: { id: true },
  });
}

export async function removeListingDefect(db: PrismaClient, id: string): Promise<void> {
  const existing = await db.listingDefect.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Defect not found");
  await db.listingDefect.delete({ where: { id } });
}

/** Load a listing and evaluate the publish checklist. */
export async function getPublishChecklist(
  db: PrismaClient,
  listingId: string,
): Promise<PublishChecklistResult> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: {
      condition: true,
      priceEur: true,
      donorVehicleId: true,
      noVisiblePartNumber: true,
      _count: { select: { photos: true } },
      part: {
        select: {
          id: true,
          category: { select: { id: true } },
          _count: { select: { partNumbers: true } },
        },
      },
    },
  });
  if (!listing) throw new NotFoundError("Listing not found");

  return evaluatePublishChecklist({
    photoCount: listing._count.photos,
    hasCondition: listing.condition != null,
    priceEur: Number(listing.priceEur),
    hasPart: listing.part != null,
    hasLeafCategory: listing.part?.category != null,
    hasDonorVehicle: listing.donorVehicleId != null,
    partNumberCount: listing.part?._count.partNumbers ?? 0,
    noVisiblePartNumber: listing.noVisiblePartNumber,
  });
}

/** `draft → published` — checklist is the gate. */
export async function publishListing(
  db: PrismaClient,
  listingId: string,
  reviewedBy?: string | null,
): Promise<void> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { status: true },
  });
  if (!listing) throw new NotFoundError("Listing not found");
  assertTransition(LISTING_TRANSITIONS, listing.status, "published", "Listing");

  const checklist = await getPublishChecklist(db, listingId);
  if (!checklist.ok) {
    throw new InvariantError(
      `Publish checklist not met: ${checklist.failures.join("; ")}`,
    );
  }

  await db.listing.update({
    where: { id: listingId },
    data: { status: "published", publishedAt: new Date(), reviewedBy: reviewedBy ?? null },
  });
}

const STAFF_TRANSITIONS: Partial<Record<ListingStatus, ListingStatus[]>> = {
  published: ["cancelled", "archived"],
  cancelled: ["published", "archived"],
};

/** Staff status changes OTHER than publish — never `reserved` / `sold`. */
export async function setListingStatusByStaff(
  db: PrismaClient,
  listingId: string,
  to: ListingStatus,
): Promise<void> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { status: true },
  });
  if (!listing) throw new NotFoundError("Listing not found");

  if (!STAFF_TRANSITIONS[listing.status]?.includes(to)) {
    throw new InvariantError(
      `Staff cannot move a listing ${listing.status} → ${to} (publish uses the checklist; reserved/sold are order-driven)`,
    );
  }
  assertTransition(LISTING_TRANSITIONS, listing.status, to, "Listing");
  await db.listing.update({ where: { id: listingId }, data: { status: to } });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
