import type { PrismaClient } from "@prisma/client";
import { isBuyer, isSeller, isStaff, type Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import { summariseTotals, type RatingSummary } from "../rating";
import { blankToNull } from "../text";
import { notify } from "./notifications";
import { isUniqueViolation } from "./prisma-errors";

/**
 * Seller reviews (docs/reviews.md, ADR-0012). Node-safe.
 *
 * Any signed-in buyer may review any seller, with or without a purchase. A review can be linked
 * to one of the buyer's own completed orders with that seller, and each order carries at most one.
 * Reviews are never edited or deleted. Staff can hide one with a reason, which removes it, its
 * reply and its rating from everything buyers see.
 */

export const MAX_REVIEW_LENGTH = 2000;
export const MAX_REPLY_LENGTH = 1000;
const NO_PURCHASE = "No purchase";

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Write a review of a seller, optionally linked to one of the buyer's completed orders. */
export async function createReview(
  db: PrismaClient,
  actor: Actor,
  input: { sellerId: string; rating: number; body?: string | null; orderId?: string | null },
): Promise<{ id: string }> {
  if (!isBuyer(actor)) throw new ForbiddenError("Reviews are written by buyer accounts");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new InvariantError("Choose a rating from 1 to 5");
  }
  const body = blankToNull(input.body);
  if (body && body.length > MAX_REVIEW_LENGTH) {
    throw new InvariantError(`A review can be at most ${MAX_REVIEW_LENGTH} characters`);
  }

  const seller = await db.seller.findUnique({ where: { id: input.sellerId }, select: { id: true, userId: true } });
  if (!seller) throw new NotFoundError("Seller not found");

  if (input.orderId) {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { buyerId: true, sellerId: true, status: true, review: { select: { id: true } } },
    });
    if (!order || order.buyerId !== actor.buyerId || order.sellerId !== input.sellerId || order.status !== "completed") {
      throw new InvariantError("That order cannot be reviewed");
    }
    if (order.review) throw new InvariantError("You have already reviewed that order");
  }

  try {
    // The review and the seller's "new review" notification stand or fall together.
    return await db.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: { sellerId: input.sellerId, buyerId: actor.buyerId!, orderId: input.orderId ?? null, rating: input.rating, body },
        select: { id: true },
      });
      await notify(tx, { userId: seller.userId, type: "review_received", subjectType: "review", subjectId: review.id });
      return review;
    });
  } catch (err) {
    // Two reviews for the same order at once: the database allows only one.
    if (isUniqueViolation(err)) throw new InvariantError("You have already reviewed that order");
    throw err;
  }
}

export interface ReviewableOrder {
  orderId: string;
  code: string;
  partName: string;
  completedAt: Date | null;
}

/** The buyer's completed orders with this seller that have no review yet, most recent first. */
export async function listReviewableOrders(db: PrismaClient, actor: Actor, sellerId: string): Promise<ReviewableOrder[]> {
  if (!isBuyer(actor)) return [];
  const rows = await db.order.findMany({
    where: { buyerId: actor.buyerId!, sellerId, status: "completed", review: { is: null } },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    select: { id: true, internalCode: true, completedAt: true, listing: { select: { part: { select: { name: true } } } } },
  });
  return rows.map((o) => ({ orderId: o.id, code: o.internalCode, partName: o.listing.part.name, completedAt: o.completedAt }));
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** The rating over every review that is shown. */
export async function getSellerRating(db: PrismaClient, sellerId: string): Promise<RatingSummary> {
  const totals = await db.review.aggregate({ where: { sellerId, hiddenAt: null }, _sum: { rating: true }, _count: { _all: true } });
  return summariseTotals(totals._sum.rating ?? 0, totals._count._all);
}

/** The ratings of many sellers in one query, for lists. A seller with no reviews still gets a summary. */
export async function getSellerRatings(db: PrismaClient, sellerIds: readonly string[]): Promise<Map<string, RatingSummary>> {
  const ids = [...new Set(sellerIds)];
  const groups = ids.length
    ? await db.review.groupBy({ by: ["sellerId"], where: { sellerId: { in: ids }, hiddenAt: null }, _sum: { rating: true }, _count: { _all: true } })
    : [];
  const bySeller = new Map(groups.map((g) => [g.sellerId, summariseTotals(g._sum.rating ?? 0, g._count._all)]));
  return new Map(ids.map((id) => [id, bySeller.get(id) ?? summariseTotals(0, 0)]));
}

export interface ReviewView {
  id: string;
  rating: number;
  body: string | null;
  authorName: string;
  /** The purchased part's name as plain text, or "No purchase". */
  context: string;
  createdAt: Date;
  reply: { body: string; at: Date | null } | null;
}

export type ReviewSort = "newest" | "highest" | "lowest";

const reviewSelect = {
  id: true,
  rating: true,
  body: true,
  createdAt: true,
  sellerReply: true,
  sellerRepliedAt: true,
  buyer: { select: { user: { select: { name: true } } } },
  order: { select: { listing: { select: { part: { select: { name: true } } } } } },
} as const;

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  sellerReply: string | null;
  sellerRepliedAt: Date | null;
  buyer: { user: { name: string } };
  order: { listing: { part: { name: string } } } | null;
};

function toView(r: ReviewRow): ReviewView {
  return {
    id: r.id,
    rating: r.rating,
    body: r.body,
    authorName: r.buyer.user.name,
    context: r.order?.listing.part.name ?? NO_PURCHASE,
    createdAt: r.createdAt,
    reply: r.sellerReply ? { body: r.sellerReply, at: r.sellerRepliedAt } : null,
  };
}

const ORDER_BY = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }, { id: "desc" }],
} as const;

/** The Reviews tab: every review that is shown, the total and the average, in the chosen order. */
export async function listSellerReviews(
  db: PrismaClient,
  sellerId: string,
  sort: ReviewSort = "newest",
): Promise<{ summary: RatingSummary; reviews: ReviewView[] }> {
  const rows = await db.review.findMany({
    where: { sellerId, hiddenAt: null },
    orderBy: [...ORDER_BY[sort]],
    select: reviewSelect,
  });
  const sum = rows.reduce((total, r) => total + r.rating, 0);
  return { summary: summariseTotals(sum, rows.length), reviews: rows.map(toView) };
}

// ---------------------------------------------------------------------------
// The seller's reply
// ---------------------------------------------------------------------------

/** The seller's own reviews that are shown, newest first, for the seller center. */
export async function listReviewsForSeller(db: PrismaClient, actor: Actor): Promise<ReviewView[]> {
  if (!isSeller(actor)) throw new ForbiddenError("Reviews of a seller are shown to that seller");
  const rows = await db.review.findMany({
    where: { sellerId: actor.sellerId!, hiddenAt: null },
    orderBy: [...ORDER_BY.newest],
    select: reviewSelect,
  });
  return rows.map(toView);
}

/** The seller replies once to a review of theirs. The reply cannot be edited or removed. */
export async function replyToReview(db: PrismaClient, actor: Actor, reviewId: string, body: string): Promise<void> {
  if (!isSeller(actor)) throw new ForbiddenError("Only the seller can reply to a review");
  const reply = blankToNull(body);
  if (!reply) throw new InvariantError("Write a reply first");
  if (reply.length > MAX_REPLY_LENGTH) throw new InvariantError(`A reply can be at most ${MAX_REPLY_LENGTH} characters`);

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { sellerId: true, hiddenAt: true, buyer: { select: { userId: true } } },
  });
  if (!review) throw new NotFoundError("Review not found");
  if (review.sellerId !== actor.sellerId) throw new ForbiddenError("Not a review of yours");
  if (review.hiddenAt) throw new InvariantError("This review is hidden");

  // The condition makes two replies at once safe: only the first one finds the reply still empty.
  await db.$transaction(async (tx) => {
    const { count } = await tx.review.updateMany({
      where: { id: reviewId, sellerReply: null, hiddenAt: null },
      data: { sellerReply: reply, sellerRepliedAt: new Date() },
    });
    if (count === 0) throw new InvariantError("You have already replied to this review");
    await notify(tx, { userId: review.buyer.userId, type: "review_replied", subjectType: "review", subjectId: reviewId });
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export interface StaffReviewView extends ReviewView {
  sellerId: string;
  sellerName: string;
  hidden: { at: Date; reason: string | null; byName: string | null } | null;
}

function assertStaff(actor: Actor): void {
  if (!isStaff(actor)) throw new ForbiddenError("Staff only");
}

/** Every review, newest first. `hidden` filters to hidden (true) or shown (false) ones. */
export async function listReviewsForStaff(
  db: PrismaClient,
  actor: Actor,
  filter: { sellerId?: string; hidden?: boolean },
): Promise<StaffReviewView[]> {
  assertStaff(actor);
  const rows = await db.review.findMany({
    where: {
      ...(filter.sellerId ? { sellerId: filter.sellerId } : {}),
      ...(filter.hidden === undefined ? {} : { hiddenAt: filter.hidden ? { not: null } : null }),
    },
    orderBy: [...ORDER_BY.newest],
    select: {
      ...reviewSelect,
      sellerId: true,
      seller: { select: { displayName: true } },
      hiddenAt: true,
      hiddenReason: true,
      hiddenBy: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    ...toView(r),
    sellerId: r.sellerId,
    sellerName: r.seller.displayName,
    hidden: r.hiddenAt ? { at: r.hiddenAt, reason: r.hiddenReason, byName: r.hiddenBy?.name ?? null } : null,
  }));
}

/** Hide a review with a required reason. Its reply and its rating drop out with it. */
export async function hideReview(db: PrismaClient, actor: Actor, reviewId: string, reason: string): Promise<void> {
  assertStaff(actor);
  const why = blankToNull(reason);
  if (!why) throw new InvariantError("Give a reason for hiding the review");
  const review = await db.review.findUnique({ where: { id: reviewId }, select: { hiddenAt: true } });
  if (!review) throw new NotFoundError("Review not found");
  if (review.hiddenAt) throw new InvariantError("This review is already hidden");
  await db.review.update({ where: { id: reviewId }, data: { hiddenAt: new Date(), hiddenById: actor.userId, hiddenReason: why } });
}

export async function unhideReview(db: PrismaClient, actor: Actor, reviewId: string): Promise<void> {
  assertStaff(actor);
  const review = await db.review.findUnique({ where: { id: reviewId }, select: { hiddenAt: true } });
  if (!review) throw new NotFoundError("Review not found");
  if (!review.hiddenAt) throw new InvariantError("This review is not hidden");
  await db.review.update({ where: { id: reviewId }, data: { hiddenAt: null, hiddenById: null, hiddenReason: null } });
}
