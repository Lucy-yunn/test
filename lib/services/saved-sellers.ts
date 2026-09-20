import type { PrismaClient } from "@prisma/client";
import { isBuyer, type Actor } from "../dal/actor";
import { ForbiddenError, NotFoundError } from "../dal/errors";
import { SELLER_AVAILABILITY_SELECT } from "../dal/seller-availability";
import { getSellerProfile, sellerHasPublicProfile } from "./seller-profile";

/**
 * Saved Sellers: a buyer's saved sellers (docs/seller-profile.md section 8). Node-safe;
 * the caller passes the Actor.
 */

export interface SavedSellerCard {
  sellerId: string;
  name: string;
  avatarUrl: string | null;
  city: string;
  lastActiveAt: Date | null;
  /** Listings in published or reserved. */
  onShelf: number;
  /** False once the seller has lost their public profile (login disabled): show greyed. */
  available: boolean;
}

const requireBuyer = (actor: Actor) => {
  if (!isBuyer(actor)) throw new ForbiddenError("Saving is for buyer accounts");
};

/** Only a seller with a public profile can be saved. Saving twice is harmless. */
export async function saveSeller(db: PrismaClient, actor: Actor, sellerId: string): Promise<void> {
  requireBuyer(actor);
  if (!(await getSellerProfile(db, sellerId))) throw new NotFoundError("Seller not found");
  await db.savedSeller.upsert({
    where: { buyerId_sellerId: { buyerId: actor.buyerId!, sellerId } },
    create: { buyerId: actor.buyerId!, sellerId },
    update: {},
  });
}

/** Idempotent, and works for a seller who has since lost their profile. */
export async function unsaveSeller(db: PrismaClient, actor: Actor, sellerId: string): Promise<void> {
  requireBuyer(actor);
  await db.savedSeller.deleteMany({ where: { buyerId: actor.buyerId!, sellerId } });
}

/** For the heart on the seller profile. Anonymous, seller and staff callers are simply "not saved". */
export async function isSellerSaved(db: PrismaClient, actor: Actor | null, sellerId: string): Promise<boolean> {
  if (!actor || !isBuyer(actor)) return false;
  return (await db.savedSeller.count({ where: { buyerId: actor.buyerId!, sellerId } })) > 0;
}

/**
 * One read for the whole list, however many sellers are saved. Whether a card is still
 * `available` is decided by the same rule as the public profile (`sellerHasPublicProfile`)
 * over what this read already loaded, not by asking the database once per seller.
 */
export async function listSavedSellers(db: PrismaClient, actor: Actor): Promise<SavedSellerCard[]> {
  requireBuyer(actor);
  const rows = await db.savedSeller.findMany({
    where: { buyerId: actor.buyerId! },
    orderBy: { createdAt: "desc" },
    select: {
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          locationCity: true,
          lastActiveAt: true,
          ...SELLER_AVAILABILITY_SELECT,
          // every listing that has ever been published: it decides the profile and gives the shelf count
          listings: { where: { publishedAt: { not: null } }, select: { status: true } },
        },
      },
    },
  });

  return rows.map(({ seller }) => ({
    sellerId: seller.id,
    name: seller.displayName,
    avatarUrl: seller.avatarUrl,
    city: seller.locationCity,
    lastActiveAt: seller.lastActiveAt,
    onShelf: seller.listings.filter((l) => l.status === "published" || l.status === "reserved").length,
    available: sellerHasPublicProfile(seller),
  }));
}
