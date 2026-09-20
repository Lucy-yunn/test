import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { InvariantError } from "../dal/errors";
import { adjustCredits, chargeForPublish, createBundle, topUp } from "./credits";
import { reserveListing, confirmOrder, completeOrder, refuseOrder, cancelOrder, approveCancellation, sweepOverdueCancellations } from "./orders";
import { createReview, replyToReview } from "./reviews";
import {
  getNotificationUnreadCount,
  listNotifications,
  markRead,
  markAllRead,
  markReviewsRead,
} from "./notifications";

/**
 * In-app notifications (docs/notifications.md): rows are written in the same transaction as the
 * change they describe, only for buyers and sellers, and the feed reads them back. Real local Postgres.
 */
const TAG = `nt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;
const DAY = 24 * 60 * 60 * 1000;

let generationId: string;
let categoryId: string;
let bundleId: string;
const userIds: string[] = [];
const sellerIds: string[] = [];
const buyerIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Buyer ${label}`), email: `buyer-${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  buyerIds.push(buyer.id);
  return { userId: user.id, role: "buyer", buyerId: buyer.id, sellerId: null, messagingBlocked: false };
}

async function mkSeller(label: string, withLogin = true) {
  let userId: string | null = null;
  if (withLogin) {
    const user = await db.user.create({ data: { name: S(`SellerUser ${label}`), email: `seller-${label}-${TAG}@example.test`, role: "seller" } });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: { displayName: S(`Seller ${label}`), contactName: "C", contactEmail: `${label}-${TAG}@x.test`, locationCity: "Plovdiv", userId },
  });
  sellerIds.push(seller.id);
  const actor: Actor = { userId: userId ?? "none", role: "seller", buyerId: null, sellerId: seller.id, messagingBlocked: false };
  return { sellerId: seller.id, userId, actor };
}

async function mkStaffUser(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Staff ${label}`), email: `staff-${label}-${TAG}@example.test`, role: "staff" } });
  userIds.push(user.id);
  return { userId: user.id, role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
}

async function mkListing(sellerId: string) {
  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S(`car-${donorIds.length}`) } });
  donorIds.push(donor.id);
  const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`part-${partIds.length}`) } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`), partId: part.id, donorVehicleId: donor.id, sellerId, priceEur: "40.00",
      condition: "used_good", status: "published", publishedAt: new Date(), noVisiblePartNumber: true,
    },
  });
  listingIds.push(listing.id);
  return { id: listing.id, code: listing.internalCode };
}

const ADDRESS = { recipientName: "R", phone: "1", addressLine1: "a", city: "c", postcode: "p" };

/** A seller, a buyer and an order reserved by that buyer. */
async function placed(label: string, now?: Date) {
  const seller = await mkSeller(label);
  const buyer = await mkBuyer(label);
  const listing = await mkListing(seller.sellerId);
  const { orderId, internalCode } = await reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS }, now);
  return { seller, buyer, listing, orderId, orderCode: internalCode };
}

const notesOf = (userId: string) =>
  db.notification.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, type: true, subjectType: true, subjectId: true, readAt: true } });

/** A credit entry that spends one credit for a publish, in its own transaction like the real one. */
const spend = (sellerId: string, listingId: string) => db.$transaction((tx) => chargeForPublish(tx, { sellerId, listingId, createdBy: null }));

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 990 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
  bundleId = (await createBundle(db, { name: S("bundle"), credits: 30, priceEur: "10.00" })).id;
});

afterAll(async () => {
  await db.notification.deleteMany({ where: { userId: { in: userIds } } });
  await db.review.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.order.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.buyer.deleteMany({ where: { id: { in: buyerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.creditBundle.deleteMany({ where: { id: bundleId } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

// ---------------------------------------------------------------------------

describe("order events", () => {
  it("tells the seller about a new order, and tells the buyer nothing about their own action", async () => {
    const t = await placed("res");

    expect(await notesOf(t.seller.userId!)).toEqual([expect.objectContaining({ type: "order_placed", subjectType: "order", subjectId: t.orderId, readAt: null })]);
    expect(await notesOf(t.buyer.userId)).toEqual([]);
  });

  it("tells the buyer when the seller confirms, completes or refuses", async () => {
    const a = await placed("conf");
    await confirmOrder(db, a.seller.actor, a.orderId);
    expect((await notesOf(a.buyer.userId)).map((n) => [n.type, n.subjectType, n.subjectId])).toEqual([["order_confirmed", "order", a.orderId]]);

    await completeOrder(db, a.seller.actor, a.orderId);
    expect((await notesOf(a.buyer.userId)).map((n) => n.type)).toEqual(["order_confirmed", "order_completed"]);

    const b = await placed("refuse");
    await confirmOrder(db, b.seller.actor, b.orderId);
    await refuseOrder(db, b.seller.actor, b.orderId, {});
    expect((await notesOf(b.buyer.userId)).map((n) => n.type)).toEqual(["order_confirmed", "order_refused"]);
    // the seller only ever heard about the new order
    expect((await notesOf(b.seller.userId!)).map((n) => n.type)).toEqual(["order_placed"]);
  });

  it("tells the seller when a buyer cancels a placed order, and the buyer nothing", async () => {
    const t = await placed("cx-placed");
    await cancelOrder(db, t.buyer, t.orderId, { reason: "no_longer_needed" });

    expect((await notesOf(t.seller.userId!)).map((n) => [n.type, n.subjectType])).toEqual([["order_placed", "order"], ["order_cancelled", "order"]]);
    expect(await notesOf(t.buyer.userId)).toEqual([]);
  });

  it("tells the seller about a cancellation request, about that request, and the buyer once it is approved", async () => {
    const t = await placed("cx-conf");
    await confirmOrder(db, t.seller.actor, t.orderId);
    await cancelOrder(db, t.buyer, t.orderId, { reason: "found_elsewhere" });
    const request = await db.cancellationRequest.findUniqueOrThrow({ where: { orderId: t.orderId } });

    expect((await notesOf(t.seller.userId!)).at(-1)).toMatchObject({ type: "cancellation_requested", subjectType: "cancellation_request", subjectId: request.id });
    expect((await notesOf(t.buyer.userId)).map((n) => n.type)).toEqual(["order_confirmed"]);

    await approveCancellation(db, t.seller.actor, t.orderId);

    expect((await notesOf(t.buyer.userId)).at(-1)).toMatchObject({ type: "cancellation_approved", subjectType: "cancellation_request", subjectId: request.id });
    expect((await notesOf(t.seller.userId!)).map((n) => n.type)).toEqual(["order_placed", "cancellation_requested"]);
  });

  it("tells the buyer once when the 7 days run out, and not again when the sweep runs again", async () => {
    const start = new Date("2001-06-01T10:00:00Z");
    const t = await placed("auto", start);
    await confirmOrder(db, t.seller.actor, t.orderId, start);
    await cancelOrder(db, t.buyer, t.orderId, { reason: "seller_too_slow" }, start);
    const later = new Date(start.getTime() + 8 * DAY);

    await sweepOverdueCancellations(db, later);
    await sweepOverdueCancellations(db, later);

    expect((await notesOf(t.buyer.userId)).filter((n) => n.type === "cancellation_approved")).toHaveLength(1);
  });

  it("writes nothing when the change is refused", async () => {
    const t = await placed("refused");
    await confirmOrder(db, t.seller.actor, t.orderId);
    await cancelOrder(db, t.buyer, t.orderId, { reason: "no_longer_needed" }); // pending request
    const buyerBefore = (await notesOf(t.buyer.userId)).length;
    const sellerBefore = (await notesOf(t.seller.userId!)).length;

    await expect(completeOrder(db, t.seller.actor, t.orderId)).rejects.toBeInstanceOf(InvariantError);
    await expect(refuseOrder(db, t.seller.actor, t.orderId, {})).rejects.toBeInstanceOf(InvariantError);
    const stranger = await mkBuyer("refused-other");
    await expect(reserveListing(db, stranger, { listingCode: t.listing.code, address: ADDRESS })).rejects.toBeInstanceOf(InvariantError); // no longer available

    expect((await notesOf(t.buyer.userId)).length).toBe(buyerBefore);
    expect((await notesOf(t.seller.userId!)).length).toBe(sellerBefore);
    expect(await notesOf(stranger.userId)).toEqual([]);
  });

  it("does not write for a seller that has no login, and does not fail", async () => {
    const seller = await mkSeller("nologin", false);
    const buyer = await mkBuyer("nologin");
    const listing = await mkListing(seller.sellerId);
    // a seller without a login cannot be reserved from, so put the order there directly and confirm it
    const order = await db.order.create({
      data: { internalCode: S("ORD-nologin"), buyerId: buyer.buyerId!, sellerId: seller.sellerId, listingId: listing.id, itemPriceEur: "40.00", ...ADDRESS },
    });
    await db.listing.update({ where: { id: listing.id }, data: { status: "reserved" } });

    await confirmOrder(db, seller.actor, order.id);

    expect((await notesOf(buyer.userId)).map((n) => n.type)).toEqual(["order_confirmed"]);
  });
});

describe("review events", () => {
  it("tells the seller about a new review, and the buyer when the seller replies", async () => {
    const seller = await mkSeller("rev");
    const buyer = await mkBuyer("rev");

    const { id } = await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5, body: "Great" });
    expect(await notesOf(seller.userId!)).toEqual([expect.objectContaining({ type: "review_received", subjectType: "review", subjectId: id })]);
    expect(await notesOf(buyer.userId)).toEqual([]);

    await replyToReview(db, seller.actor, id, "Thanks");
    expect(await notesOf(buyer.userId)).toEqual([expect.objectContaining({ type: "review_replied", subjectType: "review", subjectId: id })]);
  });

  it("writes nothing when a review or a reply is refused", async () => {
    const seller = await mkSeller("rev-bad");
    const buyer = await mkBuyer("rev-bad");
    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 9 })).rejects.toBeInstanceOf(InvariantError);
    const { id } = await createReview(db, buyer, { sellerId: seller.sellerId, rating: 4 });
    await replyToReview(db, seller.actor, id, "Once");
    await expect(replyToReview(db, seller.actor, id, "Twice")).rejects.toBeInstanceOf(InvariantError);

    expect((await notesOf(seller.userId!)).map((n) => n.type)).toEqual(["review_received"]);
    expect((await notesOf(buyer.userId)).map((n) => n.type)).toEqual(["review_replied"]);
  });

  it("does not fail for a seller with no login", async () => {
    const seller = await mkSeller("rev-nologin", false);
    const buyer = await mkBuyer("rev-nologin");
    await expect(createReview(db, buyer, { sellerId: seller.sellerId, rating: 5 })).resolves.toBeDefined();
  });
});

describe("credit events (docs/notifications.md section 3.2)", () => {
  const credits = async (label: string, balance: number) => {
    const seller = await mkSeller(label);
    if (balance > 0) await adjustCredits(db, { sellerId: seller.sellerId, amount: balance, note: "start", createdBy: null });
    const listing = await mkListing(seller.sellerId);
    return { ...seller, listingId: listing.id };
  };
  const types = async (userId: string) => (await notesOf(userId)).map((n) => n.type);

  it("says credits are low once, when a publish takes the balance from 6 to 5, about that ledger entry", async () => {
    const s = await credits("low", 6);
    expect(await types(s.userId!)).toEqual([]); // topping up and adjusting upwards never notify

    await spend(s.sellerId, s.listingId);

    const entry = await db.creditLedgerEntry.findFirstOrThrow({ where: { sellerId: s.sellerId, kind: "publish" } });
    expect(await notesOf(s.userId!)).toEqual([expect.objectContaining({ type: "credits_low", subjectType: "credit_ledger_entry", subjectId: entry.id })]);
  });

  it("does not repeat while the balance stays at 5 or fewer", async () => {
    const s = await credits("repeat", 6);
    await spend(s.sellerId, s.listingId); // 5: low
    await spend(s.sellerId, s.listingId); // 4
    await spend(s.sellerId, s.listingId); // 3
    expect(await types(s.userId!)).toEqual(["credits_low"]);
  });

  it("says out of credits when the balance reaches 0, and nothing for the refused attempt after it", async () => {
    const s = await credits("empty", 1);
    await spend(s.sellerId, s.listingId);
    expect(await types(s.userId!)).toEqual(["credits_empty"]);

    await expect(spend(s.sellerId, s.listingId)).rejects.toBeInstanceOf(InvariantError);
    expect(await types(s.userId!)).toEqual(["credits_empty"]);
  });

  it("says low when going from 6 to 1, then out of credits at 0", async () => {
    const s = await credits("both", 6);
    await adjustCredits(db, { sellerId: s.sellerId, amount: -5, note: "fix", createdBy: null }); // 1
    await spend(s.sellerId, s.listingId); // 0
    expect(await types(s.userId!)).toEqual(["credits_low", "credits_empty"]);
  });

  it("sends only out of credits when one change goes from above 5 straight to 0", async () => {
    const s = await credits("jump", 8);
    await adjustCredits(db, { sellerId: s.sellerId, amount: -8, note: "fix", createdBy: null });
    expect(await types(s.userId!)).toEqual(["credits_empty"]);
  });

  it("sends only low when an adjustment goes from 10 to 3", async () => {
    const s = await credits("adj", 10);
    await adjustCredits(db, { sellerId: s.sellerId, amount: -7, note: "fix", createdBy: null });
    expect(await types(s.userId!)).toEqual(["credits_low"]);
  });

  it("says low again after a top-up lifts the balance above 5 and it falls back", async () => {
    const s = await credits("again", 6);
    await spend(s.sellerId, s.listingId); // 5: low
    await topUp(db, { sellerId: s.sellerId, bundleId, createdBy: null }); // 35
    expect(await types(s.userId!)).toEqual(["credits_low"]); // the top-up said nothing
    await adjustCredits(db, { sellerId: s.sellerId, amount: -31, note: "fix", createdBy: null }); // 4
    expect(await types(s.userId!)).toEqual(["credits_low", "credits_low"]);
  });

  it("stays quiet for a seller with plenty of credits, and does not fail for one with no login", async () => {
    const s = await credits("plenty", 20);
    await spend(s.sellerId, s.listingId);
    expect(await types(s.userId!)).toEqual([]);

    const nologin = await mkSeller("credits-nologin", false);
    await adjustCredits(db, { sellerId: nologin.sellerId, amount: 3, note: "start", createdBy: null });
    await expect(adjustCredits(db, { sellerId: nologin.sellerId, amount: -3, note: "fix", createdBy: null })).resolves.toBeUndefined();
  });
});

describe("the feed", () => {
  async function withFeed(label: string) {
    const t = await placed(label);
    await confirmOrder(db, t.seller.actor, t.orderId);
    await completeOrder(db, t.seller.actor, t.orderId);
    return t;
  }

  it("lists a person's notifications newest first, with the line, the link and the unread state", async () => {
    const t = await withFeed("feed");

    const buyerFeed = await listNotifications(db, t.buyer);

    expect(buyerFeed.map((n) => n.type)).toEqual(["order_completed", "order_confirmed"]);
    expect(buyerFeed[0]).toMatchObject({ text: "Order completed. Leave a review?", href: `/account/orders/${t.orderCode}`, readAt: null });
    expect(buyerFeed[0].createdAt).toBeInstanceOf(Date);
    const sellerFeed = await listNotifications(db, t.seller.actor);
    expect(sellerFeed[0]).toMatchObject({ type: "order_placed", text: "You have a new order", href: `/seller/orders/${t.orderCode}` });
  });

  it("links a cancellation notification to its order, and a reply notification to the seller's reviews", async () => {
    const t = await placed("links");
    await confirmOrder(db, t.seller.actor, t.orderId);
    await cancelOrder(db, t.buyer, t.orderId, { reason: "no_longer_needed" });
    await approveCancellation(db, t.seller.actor, t.orderId);
    const review = await createReview(db, t.buyer, { sellerId: t.seller.sellerId, rating: 4 });
    await replyToReview(db, t.seller.actor, review.id, "Thanks");

    const buyerFeed = await listNotifications(db, t.buyer);
    const sellerFeed = await listNotifications(db, t.seller.actor);

    expect(buyerFeed.find((n) => n.type === "cancellation_approved")?.href).toBe(`/account/orders/${t.orderCode}`);
    expect(buyerFeed.find((n) => n.type === "review_replied")?.href).toBe(`/sellers/${t.seller.sellerId}?tab=reviews`);
    expect(sellerFeed.find((n) => n.type === "cancellation_requested")?.href).toBe(`/seller/orders/${t.orderCode}`);
    expect(sellerFeed.find((n) => n.type === "review_received")?.href).toBe("/seller/reviews");
  });

  it("counts unread ones, and only a person's own", async () => {
    const t = await withFeed("count");
    expect(await getNotificationUnreadCount(db, t.buyer)).toBe(2);
    expect(await getNotificationUnreadCount(db, t.seller.actor)).toBe(1);
    expect(await getNotificationUnreadCount(db, await mkBuyer("count-other"))).toBe(0);
  });

  it("marks everything about a subject read, for that person only", async () => {
    const t = await placed("subject");
    await confirmOrder(db, t.seller.actor, t.orderId);
    await cancelOrder(db, t.buyer, t.orderId, { reason: "no_longer_needed" });
    await approveCancellation(db, t.seller.actor, t.orderId);
    const request = await db.cancellationRequest.findUniqueOrThrow({ where: { orderId: t.orderId } });
    expect(await getNotificationUnreadCount(db, t.buyer)).toBe(2); // confirmed, cancellation approved

    const marked = await markRead(db, t.buyer, { subjectType: "order", subjectIds: [t.orderId] });
    expect(marked).toBe(1);
    expect(await getNotificationUnreadCount(db, t.buyer)).toBe(1);
    await markRead(db, t.buyer, { subjectType: "cancellation_request", subjectIds: [request.id] });
    expect(await getNotificationUnreadCount(db, t.buyer)).toBe(0);
    expect(await getNotificationUnreadCount(db, t.seller.actor)).toBe(2); // the seller's own were not touched
  });

  it("marks every notification of a kind read when no subject is named", async () => {
    const seller = await mkSeller("kind");
    const buyer = await mkBuyer("kind");
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5 });
    await createReview(db, buyer, { sellerId: seller.sellerId, rating: 4 });
    expect(await markRead(db, seller.actor, { subjectType: "review" })).toBe(2);
    expect(await getNotificationUnreadCount(db, seller.actor)).toBe(0);
  });

  it("clears the whole feed with mark all as read, and touches nobody else's", async () => {
    const t = await withFeed("all");

    expect(await markAllRead(db, t.buyer)).toBe(2);

    expect(await getNotificationUnreadCount(db, t.buyer)).toBe(0);
    expect((await listNotifications(db, t.buyer)).every((n) => n.readAt instanceof Date)).toBe(true);
    expect(await getNotificationUnreadCount(db, t.seller.actor)).toBe(1);
    expect(await markAllRead(db, t.buyer)).toBe(0); // nothing left
  });

  it("gives staff no feed", async () => {
    const staff = await mkStaffUser("feed");
    await db.notification.create({ data: { userId: staff.userId, type: "order_placed", subjectType: "order", subjectId: "x" } });
    expect(await listNotifications(db, staff)).toEqual([]);
    expect(await getNotificationUnreadCount(db, staff)).toBe(0);
    expect(await markAllRead(db, staff)).toBe(0);
    expect(await markRead(db, staff, { subjectType: "order" })).toBe(0);
  });

  it("returns only the newest ones when asked for a limit", async () => {
    const t = await withFeed("limit");
    expect((await listNotifications(db, t.buyer, { limit: 1 })).map((n) => n.type)).toEqual(["order_completed"]);
  });
});

describe("opening a seller's reviews", () => {
  it("marks a buyer's reply notices for that seller only, and a seller's review notices all", async () => {
    const a = await mkSeller("rv-a");
    const b = await mkSeller("rv-b");
    const buyer = await mkBuyer("rv");
    for (const seller of [a, b]) {
      const { id } = await createReview(db, buyer, { sellerId: seller.sellerId, rating: 5 });
      await replyToReview(db, seller.actor, id, "Thanks");
    }
    expect(await getNotificationUnreadCount(db, buyer)).toBe(2);

    expect(await markReviewsRead(db, buyer, a.sellerId)).toBe(1);

    expect(await getNotificationUnreadCount(db, buyer)).toBe(1);
    expect((await listNotifications(db, buyer)).filter((n) => !n.readAt).map((n) => n.href)).toEqual([`/sellers/${b.sellerId}?tab=reviews`]);
    expect(await markReviewsRead(db, a.actor)).toBe(1);
    expect(await getNotificationUnreadCount(db, a.actor)).toBe(0);
    expect(await getNotificationUnreadCount(db, b.actor)).toBe(1); // another seller's notice is untouched
  });
});
