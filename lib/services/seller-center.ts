import type { ListingStatus, OrderStatus, PrismaClient } from "@prisma/client";
import { isSeller, type Actor } from "../dal/actor";
import { ForbiddenError } from "../dal/errors";
import type { RatingSummary } from "../rating";
import { maskVin } from "./listing-detail";
import { getUnreadCount } from "./messaging";
import { orderSelect, sweepOverdueCancellations, toView, type OrderView } from "./orders";
import { getSellerRating } from "./reviews";

/**
 * The seller center's read side (docs/seller-center.md). Node-safe.
 *
 * Every function is scoped to the signed-in seller: it takes the seller from the `Actor`, never
 * from an argument, so a seller cannot ask for another seller's figures. Figures are live or
 * all-time counts; nothing is time-bucketed and there is no money total (section 7).
 * Anything that changes data (order actions, replies, messages) lives in the order, review and
 * messaging services.
 */

export const LOW_CREDIT_THRESHOLD = 5;

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_ORDER: OrderStatus[] = ["placed", "confirmed"];
const ON_SHELF: ListingStatus[] = ["published", "reserved"];

function sellerIdOf(actor: Actor): string {
  if (!isSeller(actor)) throw new ForbiddenError("The seller center is for seller accounts");
  return actor.sellerId!;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export interface SellerOverview {
  openOrders: number;
  pendingCancellations: number;
  unreadMessages: number;
  activeListings: number;
  totalFavourites: number;
  itemsSold: number;
  rating: RatingSummary;
  credits: { balance: number; /** 5 or fewer: shown with a warning. */ low: boolean };
}

/** The eight tiles. A cancellation whose 7 days are up is approved first, so it is not counted as pending. */
export async function getSellerOverview(db: PrismaClient, actor: Actor, now: Date = new Date()): Promise<SellerOverview> {
  const sellerId = sellerIdOf(actor);
  await sweepOverdueCancellations(db, now, { sellerId });

  const [openOrders, pendingCancellations, unreadMessages, activeListings, totalFavourites, itemsSold, rating, seller] = await Promise.all([
    db.order.count({ where: { sellerId, status: { in: OPEN_ORDER } } }),
    db.cancellationRequest.count({ where: { state: "pending", order: { sellerId } } }),
    getUnreadCount(db, actor),
    db.listing.count({ where: { sellerId, status: { in: ON_SHELF } } }),
    db.favorite.count({ where: { listing: { sellerId } } }),
    db.order.count({ where: { sellerId, status: "completed" } }),
    getSellerRating(db, sellerId),
    db.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { creditBalance: true } }),
  ]);

  return {
    openOrders,
    pendingCancellations,
    unreadMessages,
    activeListings,
    totalFavourites,
    itemsSold,
    rating,
    credits: { balance: seller.creditBalance, low: seller.creditBalance <= LOW_CREDIT_THRESHOLD },
  };
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface SellerOrderRow {
  id: string;
  code: string;
  listing: { code: string; title: string; photoUrl: string | null };
  /** The buyer's account name. The list never carries an address or a phone. */
  buyerName: string;
  status: OrderStatus;
  lastReachedStatus: OrderStatus | null;
  placedAt: Date;
  /** Whole days since it was placed, for an order that is still open. */
  ageDays: number | null;
  itemPriceEur: string;
  cancellationPending: boolean;
  autoApproveAt: Date | null;
}

/**
 * The seller's orders, newest first, with the ones that have a pending cancellation request
 * pinned to the top. `status` is a flat filter over the five values.
 */
export async function listSellerOrderRows(
  db: PrismaClient,
  actor: Actor,
  filter: { status?: OrderStatus },
  now: Date = new Date(),
): Promise<SellerOrderRow[]> {
  const sellerId = sellerIdOf(actor);
  await sweepOverdueCancellations(db, now, { sellerId });

  const rows = await db.order.findMany({
    relationLoadStrategy: "join",
    where: { sellerId, ...(filter.status ? { status: filter.status } : {}) },
    orderBy: [{ placedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      internalCode: true,
      status: true,
      lastReachedStatus: true,
      placedAt: true,
      itemPriceEur: true,
      buyer: { select: { user: { select: { name: true } } } },
      cancellationRequest: { select: { state: true, autoApproveAt: true } },
      listing: {
        select: {
          internalCode: true,
          part: { select: { name: true } },
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });

  const mapped = rows.map((o): SellerOrderRow => {
    const pending = o.cancellationRequest?.state === "pending";
    return {
      id: o.id,
      code: o.internalCode,
      listing: { code: o.listing.internalCode, title: o.listing.part.name, photoUrl: o.listing.photos[0]?.url ?? null },
      buyerName: o.buyer.user.name,
      status: o.status,
      lastReachedStatus: o.lastReachedStatus,
      placedAt: o.placedAt,
      ageDays: OPEN_ORDER.includes(o.status) ? Math.floor((now.getTime() - o.placedAt.getTime()) / DAY_MS) : null,
      itemPriceEur: String(o.itemPriceEur),
      cancellationPending: pending,
      autoApproveAt: pending ? o.cancellationRequest!.autoApproveAt : null,
    };
  });
  // Stable: within each group the newest-first order is kept.
  return [...mapped.filter((r) => r.cancellationPending), ...mapped.filter((r) => !r.cancellationPending)];
}

export interface SellerOrderDetail extends OrderView {
  part: { name: string; categoryName: string; groupName: string };
  /** The conversation with this order's buyer about this listing, if one exists. */
  threadId: string | null;
}

/** One of the seller's orders in full, with the delivery snapshot and the buyer's phone. Null when it is not theirs. */
export async function getSellerOrder(
  db: PrismaClient,
  actor: Actor,
  orderCode: string,
  now: Date = new Date(),
): Promise<SellerOrderDetail | null> {
  const sellerId = sellerIdOf(actor);
  const mine = { internalCode: orderCode, sellerId };
  await sweepOverdueCancellations(db, now, mine);

  const o = await db.order.findFirst({
    where: mine,
    select: {
      ...orderSelect,
      buyerId: true,
      listingId: true,
      listing: {
        select: {
          ...orderSelect.listing.select,
          part: { select: { name: true, category: { select: { name: true, group: { select: { name: true } } } } } },
        },
      },
    },
  });
  if (!o) return null;

  const thread = await db.thread.findUnique({
    where: { listingId_buyerId: { listingId: o.listingId, buyerId: o.buyerId } },
    select: { id: true },
  });
  return {
    ...toView(o),
    part: { name: o.listing.part.name, categoryName: o.listing.part.category.name, groupName: o.listing.part.category.group.name },
    threadId: thread?.id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export interface SellerListingRow {
  code: string;
  title: string;
  photoUrl: string | null;
  categoryName: string;
  priceEur: string;
  status: ListingStatus;
  favourites: number;
  publishedAt: Date | null;
}

/** Every listing of the seller, in all six statuses, newest first. Buyers never see four of them; the seller must. */
export async function listSellerListings(
  db: PrismaClient,
  actor: Actor,
  filter: { status?: ListingStatus },
): Promise<SellerListingRow[]> {
  const sellerId = sellerIdOf(actor);
  const rows = await db.listing.findMany({
    relationLoadStrategy: "join",
    where: { sellerId, ...(filter.status ? { status: filter.status } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      internalCode: true,
      status: true,
      priceEur: true,
      publishedAt: true,
      part: { select: { name: true, category: { select: { name: true } } } },
      photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
      _count: { select: { favorites: true } },
    },
  });
  return rows.map((l) => ({
    code: l.internalCode,
    title: l.part.name,
    photoUrl: l.photos[0]?.url ?? null,
    categoryName: l.part.category.name,
    priceEur: String(l.priceEur),
    status: l.status,
    favourites: l._count.favorites,
    publishedAt: l.publishedAt,
  }));
}

/** Listings on the shelf (published or reserved) counted by group, most first. Groups with none are left out. */
export async function getCategoryBreakdown(db: PrismaClient, actor: Actor): Promise<{ groupName: string; count: number }[]> {
  const sellerId = sellerIdOf(actor);
  const rows = await db.listing.findMany({
    where: { sellerId, status: { in: ON_SHELF } },
    select: { part: { select: { category: { select: { group: { select: { name: true } } } } } } },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const name = r.part.category.group.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([groupName, count]) => ({ groupName, count }))
    .sort((a, b) => b.count - a.count || a.groupName.localeCompare(b.groupName));
}

export interface SellerListingDetail {
  code: string;
  status: ListingStatus;
  priceEur: string;
  negotiable: boolean;
  condition: string;
  conditionNotes: string | null;
  removalNotes: string | null;
  defects: string[];
  photos: { url: string; caption: string | null }[];
  dimensions: { lengthCm: string | null; widthCm: string | null; heightCm: string | null; weightKg: string | null };
  part: { name: string; categoryName: string; groupName: string; numbers: { raw: string; numberType: string }[] };
  donor: {
    year: number | null;
    makeName: string;
    modelGroupName: string;
    generationLabel: string;
    engine: string | null;
    fuel: string | null;
    mileageKm: number | null;
    maskedVin: string | null;
  };
  counts: { favourites: number; orders: number; activeThreads: number };
}

/** One listing exactly as staff entered it, read-only, in whatever status it has. Null when it is not theirs. */
export async function getSellerListing(db: PrismaClient, actor: Actor, code: string): Promise<SellerListingDetail | null> {
  const sellerId = sellerIdOf(actor);
  const l = await db.listing.findFirst({
    relationLoadStrategy: "join",
    where: { internalCode: code, sellerId },
    select: {
      internalCode: true,
      status: true,
      priceEur: true,
      negotiable: true,
      condition: true,
      conditionNotes: true,
      removalNotes: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
      weightKg: true,
      defects: { orderBy: { displayOrder: "asc" }, select: { description: true } },
      photos: { orderBy: { displayOrder: "asc" }, select: { url: true, caption: true } },
      part: {
        select: {
          name: true,
          category: { select: { name: true, group: { select: { name: true } } } },
          partNumbers: { orderBy: [{ isPrimary: "desc" }, { normalized: "asc" }], select: { raw: true, numberType: true } },
        },
      },
      donorVehicle: {
        select: {
          donorYear: true,
          vin: true,
          engine: true,
          fuel: true,
          mileageKm: true,
          generation: { select: { label: true, modelGroup: { select: { name: true, make: { select: { name: true } } } } } },
        },
      },
      _count: { select: { favorites: true, orders: true, threads: { where: { lockedAt: null } } } },
    },
  });
  if (!l) return null;

  const d = l.donorVehicle;
  return {
    code: l.internalCode,
    status: l.status,
    priceEur: String(l.priceEur),
    negotiable: l.negotiable,
    condition: l.condition,
    conditionNotes: l.conditionNotes,
    removalNotes: l.removalNotes,
    defects: l.defects.map((x) => x.description),
    photos: l.photos,
    dimensions: {
      lengthCm: l.lengthCm != null ? String(l.lengthCm) : null,
      widthCm: l.widthCm != null ? String(l.widthCm) : null,
      heightCm: l.heightCm != null ? String(l.heightCm) : null,
      weightKg: l.weightKg != null ? String(l.weightKg) : null,
    },
    part: {
      name: l.part.name,
      categoryName: l.part.category.name,
      groupName: l.part.category.group.name,
      numbers: l.part.partNumbers,
    },
    donor: {
      year: d.donorYear,
      makeName: d.generation.modelGroup.make.name,
      modelGroupName: d.generation.modelGroup.name,
      generationLabel: d.generation.label,
      engine: d.engine,
      fuel: d.fuel,
      mileageKm: d.mileageKm,
      maskedVin: maskVin(d.vin),
    },
    counts: { favourites: l._count.favorites, orders: l._count.orders, activeThreads: l._count.threads },
  };
}

// ---------------------------------------------------------------------------
// Store details
// ---------------------------------------------------------------------------

export interface StoreDetails {
  name: string;
  avatarUrl: string | null;
  city: string;
  country: string;
  lastActiveAt: Date | null;
  /** Shown to signed-in buyers, as on the public profile. */
  phone: string | null;
  /** The earliest publish date across the seller's listings, or null before anything is published. */
  onIvoSince: Date | null;
  rating: RatingSummary;
}

/** The seller's own public profile fields, as buyers see them. It never includes the contact email or the street address. */
export async function getStoreDetails(db: PrismaClient, actor: Actor): Promise<StoreDetails> {
  const sellerId = sellerIdOf(actor);
  const [seller, first, rating] = await Promise.all([
    db.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { displayName: true, avatarUrl: true, locationCity: true, locationCountry: true, lastActiveAt: true, contactPhone: true },
    }),
    db.listing.aggregate({ where: { sellerId, publishedAt: { not: null } }, _min: { publishedAt: true } }),
    getSellerRating(db, sellerId),
  ]);
  return {
    name: seller.displayName,
    avatarUrl: seller.avatarUrl,
    city: seller.locationCity,
    country: seller.locationCountry,
    lastActiveAt: seller.lastActiveAt,
    phone: seller.contactPhone,
    onIvoSince: first._min.publishedAt,
    rating,
  };
}
