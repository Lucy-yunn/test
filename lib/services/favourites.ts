import type { PrismaClient } from "@prisma/client";
import { isBuyer, type Actor } from "../dal/actor";
import { ForbiddenError, NotFoundError } from "../dal/errors";

/**
 * Saved Parts — a buyer's saved Listings (docs/seller-profile.md §8,
 * docs/seller-center.md §10). Node-safe; the caller passes the Actor.
 */

export type Availability = "available" | "reserved" | "sold" | "unavailable";

/** Saved-part badge from the retained Listing's status (docs/seller-center.md §10). */
export function availabilityOf(status: string): Availability {
  if (status === "published") return "available";
  if (status === "reserved") return "reserved";
  if (status === "sold") return "sold";
  return "unavailable";
}

/** "Find similar": re-enter the funnel (slugs) at the saved part's category. */
export function findSimilarHref(slugs: { make: string; model: string; generation: string; category: string }): string {
  const p = new URLSearchParams({
    make: slugs.make,
    model: slugs.model,
    generation: slugs.generation,
    category: slugs.category,
  });
  return `/browse?${p.toString()}`;
}

export interface SavedPart {
  code: string;
  title: string;
  priceEur: string;
  photoUrl: string | null;
  availability: Availability;
  savedAt: Date;
  similarHref: string;
}

export async function saveListing(db: PrismaClient, actor: Actor, listingCode: string): Promise<void> {
  if (!isBuyer(actor)) throw new ForbiddenError("Saving is for buyer accounts");
  const listing = await db.listing.findFirst({
    where: { internalCode: listingCode, status: { in: ["published", "reserved"] } },
    select: { id: true },
  });
  if (!listing) throw new NotFoundError("Listing not found");
  await db.favorite.upsert({
    where: { buyerId_listingId: { buyerId: actor.buyerId!, listingId: listing.id } },
    create: { buyerId: actor.buyerId!, listingId: listing.id },
    update: {},
  });
}

/** Idempotent. Works for any listing status: a sold or hidden saved part can still be removed. */
export async function unsaveListing(db: PrismaClient, actor: Actor, listingCode: string): Promise<void> {
  if (!isBuyer(actor)) throw new ForbiddenError("Saving is for buyer accounts");
  await db.favorite.deleteMany({
    where: { buyerId: actor.buyerId!, listing: { internalCode: listingCode } },
  });
}

/** For the listing page's Save / Saved button. Anonymous, seller and staff callers are simply "not saved". */
export async function isListingSaved(db: PrismaClient, actor: Actor | null, listingCode: string): Promise<boolean> {
  if (!actor || !isBuyer(actor)) return false;
  const count = await db.favorite.count({
    where: { buyerId: actor.buyerId!, listing: { internalCode: listingCode } },
  });
  return count > 0;
}

export async function listSavedParts(db: PrismaClient, actor: Actor): Promise<SavedPart[]> {
  if (!isBuyer(actor)) throw new ForbiddenError("Saving is for buyer accounts");
  const rows = await db.favorite.findMany({
    where: { buyerId: actor.buyerId! },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      listing: {
        select: {
          internalCode: true,
          status: true,
          priceEur: true,
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
          part: { select: { name: true, category: { select: { slug: true } } } },
          donorVehicle: {
            select: {
              generation: {
                select: { slug: true, modelGroup: { select: { slug: true, make: { select: { slug: true } } } } },
              },
            },
          },
        },
      },
    },
  });
  return rows.map(({ createdAt, listing: l }) => {
    const gen = l.donorVehicle.generation;
    return {
      code: l.internalCode,
      title: l.part.name,
      priceEur: String(l.priceEur),
      photoUrl: l.photos[0]?.url ?? null,
      availability: availabilityOf(l.status),
      savedAt: createdAt,
      similarHref: findSimilarHref({
        make: gen.modelGroup.make.slug,
        model: gen.modelGroup.slug,
        generation: gen.slug,
        category: l.part.category.slug,
      }),
    };
  });
}
