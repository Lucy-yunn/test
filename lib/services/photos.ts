import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { InvariantError, NotFoundError } from "../dal/errors";
import { downscaleForWeb } from "../images";

/**
 * Photo ingest (docs/spec/admin-tool.md §6.2.3, ADR-0001). Node-safe.
 *
 * The store is INJECTED (not imported) so this stays testable without a Vercel
 * Blob token — Server Actions pass `blobPhotoStore` from lib/storage.ts. Only the
 * downscaled result is uploaded; the DB row keeps URL + metadata only.
 */
export interface PhotoStore {
  upload(
    key: string,
    data: Buffer,
    contentType: string,
  ): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
}

/** Soft cap — a storage-cost guard (#8). */
export const PHOTO_SOFT_CAP = 15;

async function ingest(
  store: PhotoStore,
  folder: string,
  image: Buffer,
): Promise<string> {
  const processed = await downscaleForWeb(image);
  const key = `${folder}/${randomUUID()}.jpg`;
  const { url } = await store.upload(key, processed.data, processed.contentType);
  return url;
}

export async function addListingPhoto(
  db: PrismaClient,
  store: PhotoStore,
  args: { listingId: string; image: Buffer; caption?: string | null },
): Promise<{ id: string; url: string }> {
  const listing = await db.listing.findUnique({
    where: { id: args.listingId },
    select: { _count: { select: { photos: true } } },
  });
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing._count.photos >= PHOTO_SOFT_CAP) {
    throw new InvariantError(`Photo limit reached (${PHOTO_SOFT_CAP})`);
  }

  const url = await ingest(store, `listings/${args.listingId}`, args.image);
  return db.listingPhoto.create({
    data: {
      listingId: args.listingId,
      url,
      displayOrder: listing._count.photos,
      caption: args.caption?.trim() || null,
    },
    select: { id: true, url: true },
  });
}

export async function addDonorVehiclePhoto(
  db: PrismaClient,
  store: PhotoStore,
  args: { donorVehicleId: string; image: Buffer; caption?: string | null },
): Promise<{ id: string; url: string }> {
  const dv = await db.donorVehicle.findUnique({
    where: { id: args.donorVehicleId },
    select: { _count: { select: { photos: true } } },
  });
  if (!dv) throw new NotFoundError("Donor vehicle not found");
  if (dv._count.photos >= PHOTO_SOFT_CAP) {
    throw new InvariantError(`Photo limit reached (${PHOTO_SOFT_CAP})`);
  }

  const url = await ingest(store, `donor-vehicles/${args.donorVehicleId}`, args.image);
  return db.donorVehiclePhoto.create({
    data: {
      donorVehicleId: args.donorVehicleId,
      url,
      displayOrder: dv._count.photos,
      caption: args.caption?.trim() || null,
    },
    select: { id: true, url: true },
  });
}

export async function removeListingPhoto(
  db: PrismaClient,
  store: PhotoStore,
  id: string,
): Promise<void> {
  const photo = await db.listingPhoto.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!photo) throw new NotFoundError("Photo not found");
  await db.listingPhoto.delete({ where: { id } });
  await store.delete(photo.url).catch(() => {
    /* orphaned blob — acceptable; the DB is the source of truth */
  });
}

export async function removeDonorVehiclePhoto(
  db: PrismaClient,
  store: PhotoStore,
  id: string,
): Promise<void> {
  const photo = await db.donorVehiclePhoto.findUnique({
    where: { id },
    select: { url: true },
  });
  if (!photo) throw new NotFoundError("Photo not found");
  await db.donorVehiclePhoto.delete({ where: { id } });
  await store.delete(photo.url).catch(() => {});
}

/** Swap a listing photo's order with its neighbour (first = primary). */
export async function moveListingPhoto(
  db: PrismaClient,
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const photo = await db.listingPhoto.findUnique({
    where: { id },
    select: { id: true, listingId: true, displayOrder: true },
  });
  if (!photo) throw new NotFoundError("Photo not found");

  const neighbour = await db.listingPhoto.findFirst({
    where: {
      listingId: photo.listingId,
      displayOrder: direction === "up" ? { lt: photo.displayOrder } : { gt: photo.displayOrder },
    },
    orderBy: { displayOrder: direction === "up" ? "desc" : "asc" },
    select: { id: true, displayOrder: true },
  });
  if (!neighbour) return; // already at the end

  await db.$transaction([
    db.listingPhoto.update({ where: { id: photo.id }, data: { displayOrder: neighbour.displayOrder } }),
    db.listingPhoto.update({ where: { id: neighbour.id }, data: { displayOrder: photo.displayOrder } }),
  ]);
}
