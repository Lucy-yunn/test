import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import { getBuyerOrder } from "./orders";
import {
  MAX_REVIEW_LENGTH,
  MAX_REPLY_LENGTH,
  createReview,
  listReviewableOrders,
  getSellerRating,
  getSellerRatings,
  listSellerReviews,
  listReviewsForSeller,
  replyToReview,
  listReviewsForStaff,
  hideReview,
  unhideReview,
} from "./reviews";

/**
 * Seller reviews (docs/reviews.md, ADR-0012): who can write, the purchase link, the rating
 * aggregate and "New seller", the seller's single reply, and staff hiding. Real local Postgres.
 */
const TAG = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let generationId: string;
let categoryId: string;
const userIds: string[] = [];
const sellerIds: string[] = [];
const buyerIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Buyer ${label}`), email: `SECRET-${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  buyerIds.push(buyer.id);
  return { userId: user.id, role: "buyer", buyerId: buyer.id, sellerId: null, messagingBlocked: false };
}

async function mkStaff(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Staff ${label}`), email: `staff-${label}-${TAG}@example.test`, role: "staff" } });
  userIds.push(user.id);
  return { userId: user.id, role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
}

async function mkSeller(label: string) {
  const user = await db.user.create({ data: { name: S(`SellerUser ${label}`), email: `${label}-${TAG}@example.test`, role: "seller" } });
  userIds.push(user.id);
  const seller = await db.seller.create({
    data: { displayName: S(`Seller ${label}`), contactName: "C", contactEmail: `${label}-${TAG}@x.test`, locationCity: "Plovdiv", userId: user.id },
  });
  sellerIds.push(seller.id);
  const actor: Actor = { userId: user.id, role: "seller", buyerId: null, sellerId: seller.id, messagingBlocked: false };
  return { sellerId: seller.id, actor };
}

/** An order with the given status for this buyer and seller, on a fresh listing whose part has a known name. */
async function mkOrder(buyer: Actor, sellerId: string, status: "completed" | "placed" | "confirmed" | "cancelled" | "refused" = "completed", completedAt = new Date()) {
  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S(`car-${donorIds.length}`) } });
  donorIds.push(donor.id);
  const partName = S(`Turbo ${partIds.length}`);
  const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: partName } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`), partId: part.id, donorVehicleId: donor.id, sellerId, priceEur: "90.00",
      condition: "used_good", status: "sold", publishedAt: new Date(), noVisiblePartNumber: true,
    },
  });
  listingIds.push(listing.id);
  const order = await db.order.create({
    data: {
      internalCode: S(`ORD-${listingIds.length}`), buyerId: buyer.buyerId!, sellerId, listingId: listing.id, itemPriceEur: "90.00", status,
      completedAt: status === "completed" ? completedAt : null,
      recipientName: "R", phone: "1", addressLine1: "a", city: "c", postcode: "p",
    },
  });
  return { orderId: order.id, code: order.internalCode, partName };
}

const pause = () => new Promise((r) => setTimeout(r, 5));

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 980 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  await db.review.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.order.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.buyer.deleteMany({ where: { id: { in: buyerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

// ---------------------------------------------------------------------------

describe("writing a review", () => {
  it("is open to any signed-in buyer, with no purchase and no limit per buyer", async () => {
    const seller = await mkSeller("open");
    const buyer = await mkBuyer("open");

    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 4, body: "Fast reply" });
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "  Second visit  " });

    const rows = await db.review.findMany({ where: { sellerId: seller.sellerId }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.rating, r.body, r.orderId])).toEqual([[4, "Fast reply", null], [5, "Second visit", null]]);
    expect(rows[0]).toMatchObject({ buyerId: buyer.buyerId, hiddenAt: null, sellerReply: null });
  });

  it("stores no text when the buyer wrote none", async () => {
    const seller = await mkSeller("notext");
    const buyer = await mkBuyer("notext");
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 3 });
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 3, body: "   " });
    expect((await db.review.findMany({ where: { sellerId: seller.sellerId } })).map((r) => r.body)).toEqual([null, null]);
  });

  it("needs a whole rating from 1 to 5 and at most 2,000 characters of text", async () => {
    const seller = await mkSeller("valid");
    const buyer = await mkBuyer("valid");
    for (const rating of [0, 6, -1, 3.5, Number.NaN]) {
      await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating })).rejects.toBeInstanceOf(InvariantError);
    }
    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "x".repeat(MAX_REVIEW_LENGTH + 1) })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.review.count({ where: { sellerId: seller.sellerId } })).toBe(0);

    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "x".repeat(MAX_REVIEW_LENGTH) })).resolves.toBeDefined();
    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 1 })).resolves.toBeDefined();
  });

  it("the database itself refuses a rating outside 1 to 5", async () => {
    const seller = await mkSeller("dbcheck");
    const buyer = await mkBuyer("dbcheck");
    await expect(db.review.create({ data: { sellerId: seller.sellerId, buyerId: buyer.buyerId!, rating: 9 } })).rejects.toThrow();
  });

  it("is for buyer accounts only", async () => {
    const seller = await mkSeller("role");
    for (const actor of [seller.actor, await mkStaff("role")]) {
      await expect(createReview(db, actor, { sellerId: seller.sellerId, rating: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.review.count({ where: { sellerId: seller.sellerId } })).toBe(0);
  });

  it("says so when the seller does not exist", async () => {
    await expect(createReview(db, await mkBuyer("noseller"), { sellerId: "nope", rating: 5 })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("linking a review to a purchase", () => {
  it("links to the buyer's own completed order with this seller, once", async () => {
    const seller = await mkSeller("link");
    const buyer = await mkBuyer("link");
    const order = await mkOrder(buyer, seller.sellerId);

    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "Great part", orderId: order.orderId });

    expect((await db.review.findFirstOrThrow({ where: { sellerId: seller.sellerId } })).orderId).toBe(order.orderId);
    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 4, orderId: order.orderId })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.review.count({ where: { sellerId: seller.sellerId } })).toBe(1);
  });

  it("refuses an order that is not completed, not the buyer's, or with another seller", async () => {
    const seller = await mkSeller("badlink");
    const other = await mkSeller("badlink-other");
    const buyer = await mkBuyer("badlink");
    const stranger = await mkBuyer("badlink-stranger");
    const bad = [
      (await mkOrder(buyer, seller.sellerId, "placed")).orderId,
      (await mkOrder(buyer, seller.sellerId, "confirmed")).orderId,
      (await mkOrder(buyer, seller.sellerId, "cancelled")).orderId,
      (await mkOrder(buyer, seller.sellerId, "refused")).orderId,
      (await mkOrder(stranger, seller.sellerId)).orderId, // someone else's completed order
      (await mkOrder(buyer, other.sellerId)).orderId, // completed, but with another seller
      "no-such-order",
    ];
    for (const orderId of bad) {
      await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, orderId })).rejects.toBeInstanceOf(InvariantError);
    }
    expect(await db.review.count({ where: { sellerId: { in: [seller.sellerId, other.sellerId] } } })).toBe(0);
  });

  it("two reviews for the same order at the same moment leave only one", async () => {
    const seller = await mkSeller("racelink");
    const buyer = await mkBuyer("racelink");
    const order = await mkOrder(buyer, seller.sellerId);

    const results = await Promise.allSettled([
      createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, orderId: order.orderId }),
      createReview(db, buyer, { sellerId: seller.sellerId, rating: 4, orderId: order.orderId }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason).toBeInstanceOf(InvariantError);
    expect(await db.review.count({ where: { orderId: order.orderId } })).toBe(1);
  });

  it("offers the buyer's completed orders with this seller that are not reviewed yet, newest first", async () => {
    const seller = await mkSeller("offer");
    const buyer = await mkBuyer("offer");
    const older = await mkOrder(buyer, seller.sellerId, "completed", new Date("2026-08-01T10:00:00Z"));
    const newer = await mkOrder(buyer, seller.sellerId, "completed", new Date("2026-09-01T10:00:00Z"));
    const reviewed = await mkOrder(buyer, seller.sellerId, "completed", new Date("2026-09-10T10:00:00Z"));
    await mkOrder(buyer, seller.sellerId, "placed");
    await mkOrder(await mkBuyer("offer-other"), seller.sellerId);
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, orderId: reviewed.orderId });

    const offered = await listReviewableOrders(db, buyer, seller.sellerId);

    expect(offered.map((o) => o.orderId)).toEqual([newer.orderId, older.orderId]);
    expect(offered[0]).toMatchObject({ code: newer.code, partName: newer.partName });
    expect(await listReviewableOrders(db, seller.actor, seller.sellerId)).toEqual([]);
  });

  it("marks the buyer's order as reviewed, so its page stops offering Leave a review", async () => {
    const seller = await mkSeller("flag");
    const buyer = await mkBuyer("flag");
    const order = await mkOrder(buyer, seller.sellerId);
    expect((await getBuyerOrder(db, buyer, order.code))?.reviewed).toBe(false);

    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, orderId: order.orderId });

    expect((await getBuyerOrder(db, buyer, order.code))?.reviewed).toBe(true);
  });
});

describe("the rating", () => {
  it("is New seller below 3 reviews and a number from 3, counting reviews with and without a purchase", async () => {
    const seller = await mkSeller("agg");
    const buyer = await mkBuyer("agg");
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5 });
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5 });
    expect(await getSellerRating(db, seller.sellerId)).toEqual({ count: 2, average: 5, isNew: true });

    const order = await mkOrder(buyer, seller.sellerId);
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 4, orderId: order.orderId });

    expect(await getSellerRating(db, seller.sellerId)).toEqual({ count: 3, average: 4.7, isNew: false });
  });

  it("is New seller with no reviews at all", async () => {
    const seller = await mkSeller("none");
    expect(await getSellerRating(db, seller.sellerId)).toEqual({ count: 0, average: null, isNew: true });
  });

  it("gives the same numbers for many sellers at once, with a summary for a seller that has none", async () => {
    const a = await mkSeller("batch-a");
    const b = await mkSeller("batch-b");
    const c = await mkSeller("batch-c");
    const buyer = await mkBuyer("batch");
    for (const rating of [5, 4, 3]) await createReview(db, buyer, { sellerId: a.sellerId, rating });
    await createReview(db, buyer, { sellerId: b.sellerId, rating: 1 });

    const ratings = await getSellerRatings(db, [a.sellerId, b.sellerId, c.sellerId]);

    expect(ratings.get(a.sellerId)).toEqual(await getSellerRating(db, a.sellerId));
    expect(ratings.get(b.sellerId)).toEqual({ count: 1, average: 1, isNew: true });
    expect(ratings.get(c.sellerId)).toEqual({ count: 0, average: null, isNew: true });
  });
});

describe("the Reviews tab", () => {
  async function tabFixture(label: string) {
    const seller = await mkSeller(label);
    const buyer = await mkBuyer(label);
    const order = await mkOrder(buyer, seller.sellerId);
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 3, body: "third" }); await pause();
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "first", orderId: order.orderId }); await pause();
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 3, body: "second" }); await pause();
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 1, body: "last" });
    return { seller, buyer, order };
  }

  it("sorts by newest by default, and by highest or lowest with the newest first among equals", async () => {
    const { seller } = await tabFixture("sort");
    const bodies = async (sort?: "newest" | "highest" | "lowest") => (await listSellerReviews(db, seller.sellerId, sort)).reviews.map((r) => r.body);

    expect(await bodies()).toEqual(["last", "second", "first", "third"]);
    expect(await bodies("newest")).toEqual(["last", "second", "first", "third"]);
    expect(await bodies("highest")).toEqual(["first", "second", "third", "last"]);
    expect(await bodies("lowest")).toEqual(["last", "second", "third", "first"]);
  });

  it("shows the total and average, the author's name and the context label", async () => {
    const { seller, order } = await tabFixture("view");

    const { summary, reviews } = await listSellerReviews(db, seller.sellerId);

    expect(summary).toEqual({ count: 4, average: 3, isNew: false });
    const linked = reviews.find((r) => r.body === "first");
    expect(linked).toMatchObject({ rating: 5, context: order.partName, authorName: S("Buyer view") });
    expect(reviews.find((r) => r.body === "last")?.context).toBe("No purchase");
  });

  it("never gives out the reviewer's email", async () => {
    const { seller } = await tabFixture("privacy");
    expect(JSON.stringify(await listSellerReviews(db, seller.sellerId))).not.toContain("SECRET");
  });
});

describe("the seller's reply", () => {
  async function oneReview(label: string) {
    const seller = await mkSeller(label);
    const buyer = await mkBuyer(label);
    const { id } = await createReview(db, buyer, { sellerId: seller.sellerId, rating: 2, body: "Slow" });
    return { seller, buyer, reviewId: id };
  }

  it("is written once by the seller the review is about, and shown beneath the review", async () => {
    const r = await oneReview("reply");

    await replyToReview(db, r.seller.actor, r.reviewId, "  Sorry about the wait.  ");

    const row = await db.review.findUniqueOrThrow({ where: { id: r.reviewId } });
    expect(row.sellerReply).toBe("Sorry about the wait.");
    expect(row.sellerRepliedAt).toBeInstanceOf(Date);
    const shown = (await listSellerReviews(db, r.seller.sellerId)).reviews[0];
    expect(shown.reply).toMatchObject({ body: "Sorry about the wait." });
    expect(shown.reply?.at).toBeInstanceOf(Date);
  });

  it("cannot be replaced or added to", async () => {
    const r = await oneReview("once");
    await replyToReview(db, r.seller.actor, r.reviewId, "First");
    await expect(replyToReview(db, r.seller.actor, r.reviewId, "Second")).rejects.toBeInstanceOf(InvariantError);
    expect((await db.review.findUniqueOrThrow({ where: { id: r.reviewId } })).sellerReply).toBe("First");
  });

  it("two replies at the same moment leave one", async () => {
    const r = await oneReview("racereply");
    const results = await Promise.allSettled([
      replyToReview(db, r.seller.actor, r.reviewId, "A"),
      replyToReview(db, r.seller.actor, r.reviewId, "B"),
    ]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("is only for the seller the review is about, never a buyer, another seller or staff", async () => {
    const r = await oneReview("who");
    const other = await mkSeller("who-other");
    for (const actor of [r.buyer, other.actor, await mkStaff("who")]) {
      await expect(replyToReview(db, actor, r.reviewId, "hi")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await db.review.findUniqueOrThrow({ where: { id: r.reviewId } })).sellerReply).toBeNull();
  });

  it("needs some text, at most 1,000 characters", async () => {
    const r = await oneReview("len");
    for (const body of ["", "   ", "x".repeat(MAX_REPLY_LENGTH + 1)]) {
      await expect(replyToReview(db, r.seller.actor, r.reviewId, body)).rejects.toBeInstanceOf(InvariantError);
    }
    await expect(replyToReview(db, r.seller.actor, r.reviewId, "x".repeat(MAX_REPLY_LENGTH))).resolves.toBeUndefined();
  });

  it("lists the seller's own reviews, newest first, and only theirs", async () => {
    const r = await oneReview("mine");
    const other = await mkSeller("mine-other");
    await createReview(db, await mkBuyer("mine-b2"), { sellerId: other.sellerId, rating: 5, body: "not mine" });

    const mine = await listReviewsForSeller(db, r.seller.actor);

    expect(mine.map((x) => x.body)).toEqual(["Slow"]);
    await expect(listReviewsForSeller(db, r.buyer)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("staff hiding a review", () => {
  async function reviewed(label: string) {
    const seller = await mkSeller(label);
    const buyer = await mkBuyer(label);
    const ids: string[] = [];
    for (const rating of [5, 5, 5]) ids.push((await createReview(db, buyer, { sellerId: seller.sellerId, rating, body: `r${rating}` })).id);
    const bad = (await createReview(db, buyer, { sellerId: seller.sellerId, rating: 1, body: "spam" })).id;
    await replyToReview(db, seller.actor, bad, "This is not true");
    return { seller, buyer, bad, staff: await mkStaff(label) };
  }

  it("needs a reason, and removes the review, its reply and its rating from what buyers see", async () => {
    const t = await reviewed("hide");
    expect((await getSellerRating(db, t.seller.sellerId)).average).toBe(4.0);
    for (const reason of ["", "   "]) {
      await expect(hideReview(db, t.staff, t.bad, reason)).rejects.toBeInstanceOf(InvariantError);
    }

    await hideReview(db, t.staff, t.bad, "  Abusive  ");

    expect(await db.review.findUniqueOrThrow({ where: { id: t.bad } })).toMatchObject({ hiddenReason: "Abusive", hiddenById: t.staff.userId });
    const { summary, reviews } = await listSellerReviews(db, t.seller.sellerId);
    expect(summary).toEqual({ count: 3, average: 5, isNew: false });
    expect(reviews.map((r) => r.body)).not.toContain("spam");
    expect(JSON.stringify(reviews)).not.toContain("This is not true");
    expect(await listReviewsForSeller(db, t.seller.actor)).toHaveLength(3);
    await expect(replyToReview(db, t.seller.actor, t.bad, "more")).rejects.toBeInstanceOf(InvariantError);
  });

  it("a hidden review cannot be hidden again, and unhiding brings everything back", async () => {
    const t = await reviewed("unhide");
    await hideReview(db, t.staff, t.bad, "Abusive");
    await expect(hideReview(db, t.staff, t.bad, "Again")).rejects.toBeInstanceOf(InvariantError);

    await unhideReview(db, t.staff, t.bad);

    expect(await db.review.findUniqueOrThrow({ where: { id: t.bad } })).toMatchObject({ hiddenAt: null, hiddenById: null, hiddenReason: null });
    const { summary, reviews } = await listSellerReviews(db, t.seller.sellerId);
    expect(summary.average).toBe(4);
    expect(reviews.find((r) => r.body === "spam")?.reply?.body).toBe("This is not true");
    await expect(unhideReview(db, t.staff, t.bad)).rejects.toBeInstanceOf(InvariantError);
  });

  it("is for staff only", async () => {
    const t = await reviewed("staffonly");
    for (const actor of [t.buyer, t.seller.actor]) {
      await expect(hideReview(db, actor, t.bad, "x")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(unhideReview(db, actor, t.bad)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listReviewsForStaff(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
    }
    await expect(hideReview(db, t.staff, "nope", "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists every review for staff, newest first, filtered by seller and by hidden or visible", async () => {
    const t = await reviewed("stafflist");
    const other = await mkSeller("stafflist-other");
    await createReview(db, t.buyer, { sellerId: other.sellerId, rating: 4, body: "elsewhere" });
    await hideReview(db, t.staff, t.bad, "Abusive");

    const all = await listReviewsForStaff(db, t.staff, { sellerId: t.seller.sellerId });
    expect(all).toHaveLength(4);
    expect(all[0].body).toBe("spam"); // newest first
    expect(all[0]).toMatchObject({
      sellerName: S("Seller stafflist"),
      authorName: S("Buyer stafflist"),
      context: "No purchase",
      reply: { body: "This is not true" },
      hidden: { reason: "Abusive" },
    });

    expect((await listReviewsForStaff(db, t.staff, { sellerId: t.seller.sellerId, hidden: true })).map((r) => r.body)).toEqual(["spam"]);
    expect((await listReviewsForStaff(db, t.staff, { sellerId: t.seller.sellerId, hidden: false })).map((r) => r.body)).not.toContain("spam");
    expect((await listReviewsForStaff(db, t.staff, { sellerId: other.sellerId })).map((r) => r.body)).toEqual(["elsewhere"]);
  });
});
