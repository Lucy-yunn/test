import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError } from "../dal/errors";
import { adjustCredits } from "./credits";
import { createReview, hideReview } from "./reviews";
import { startThread, startThreadWithOrderBuyer } from "./messaging";
import { reserveListing, confirmOrder, completeOrder, refuseOrder, cancelOrder, approveCancellation } from "./orders";
import {
  getSellerOverview,
  listSellerOrderRows,
  getSellerOrder,
  listSellerListings,
  getCategoryBreakdown,
  getSellerListing,
  getStoreDetails,
} from "./seller-center";

/**
 * The seller center's read side (docs/seller-center.md): the overview figures, the seller's
 * orders and listings, and the store details. Every screen is scoped to the signed-in seller.
 * Real local Postgres.
 */
const TAG = `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;
const DAY = 24 * 60 * 60 * 1000;

let generationId: string;
const userIds: string[] = [];
const sellerIds: string[] = [];
const buyerIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];
const categoryIds: string[] = [];
const groupIds: string[] = [];
let categoryA: { id: string; name: string; groupName: string };
let categoryB: { id: string; name: string; groupName: string };

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Buyer ${label}`), email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  buyerIds.push(buyer.id);
  return { userId: user.id, role: "buyer", buyerId: buyer.id, sellerId: null, messagingBlocked: false };
}

const staff: Actor = { userId: "staff-x", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

async function mkRealStaff(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Staff ${label}`), email: `staff-${label}-${TAG}@example.test`, role: "staff" } });
  userIds.push(user.id);
  return { userId: user.id, role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
}

async function mkSeller(label: string) {
  const user = await db.user.create({ data: { name: S(`SellerUser ${label}`), email: `seller-${label}-${TAG}@example.test`, role: "seller" } });
  userIds.push(user.id);
  const seller = await db.seller.create({
    data: {
      displayName: S(`Seller ${label}`),
      contactName: "C",
      contactEmail: `SECRET-EMAIL-${label}-${TAG}@x.test`,
      contactPhone: "+359 88 000 1234",
      locationLine1: "SECRET-STREET 1",
      locationCity: "Plovdiv",
      avatarUrl: "https://x/avatar.jpg",
      userId: user.id,
    },
  });
  sellerIds.push(seller.id);
  const actor: Actor = { userId: user.id, role: "seller", buyerId: null, sellerId: seller.id, messagingBlocked: false };
  return { sellerId: seller.id, actor };
}

type ListingStatus = "draft" | "published" | "reserved" | "sold" | "cancelled" | "archived";
async function mkListing(sellerId: string, status: ListingStatus = "published", cat = categoryA, extra: { vin?: string; publishedAt?: Date } = {}) {
  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S(`car-${donorIds.length}`), vin: extra.vin ?? null, donorYear: 2012 } });
  donorIds.push(donor.id);
  const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId: cat.id, name: S(`part-${partIds.length}`) } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: part.id,
      donorVehicleId: donor.id,
      sellerId,
      priceEur: "75.00",
      condition: "used_good",
      conditionNotes: "Minor scuffs",
      status,
      publishedAt: status === "draft" ? null : (extra.publishedAt ?? new Date()),
      noVisiblePartNumber: true,
      photos: { create: { url: "https://x/l.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(listing.id);
  return { id: listing.id, code: listing.internalCode, partName: part.name };
}

/** An order in the wanted state, reached through the real order functions so the listing follows. */
async function mkOrder(buyer: Actor, sellerId: string, status: "placed" | "confirmed" | "completed" | "cancelled" | "refused", opts: { now?: Date; pending?: boolean } = {}) {
  const listing = await mkListing(sellerId, "published");
  const seller: Actor = { userId: "x", role: "seller", buyerId: null, sellerId, messagingBlocked: false };
  const now = opts.now ?? new Date();
  const { orderId, internalCode } = await reserveListing(
    db,
    buyer,
    { listingCode: listing.code, address: { recipientName: "Recipient", phone: "+359 SECRET-PHONE", addressLine1: "SECRET-ADDRESS 5", city: "Sofia", postcode: "1000" } },
    now,
  );
  if (status !== "placed") await confirmOrder(db, seller, orderId, now);
  if (status === "completed") await completeOrder(db, seller, orderId, now);
  if (status === "refused") await refuseOrder(db, seller, orderId, {}, now);
  if (status === "cancelled" || opts.pending) {
    await cancelOrder(db, buyer, orderId, { reason: opts.pending ? "found_elsewhere" : "no_longer_needed" }, now);
    if (status === "cancelled") await approveCancellation(db, seller, orderId, now);
  }
  return { orderId, code: internalCode, listing };
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const make2 = async (n: string, order: number) => {
    const group = await db.group.create({ data: { name: S(`Grp ${n}`), slug: S(`grp-${n}`), displayOrder: 985 + order } });
    groupIds.push(group.id);
    const cat = await db.category.create({ data: { name: S(`Cat ${n}`), slug: S(`cat-${n}`), groupId: group.id, displayOrder: 1 } });
    categoryIds.push(cat.id);
    return { id: cat.id, name: cat.name, groupName: group.name };
  };
  categoryA = await make2("A", 1);
  categoryB = await make2("B", 2);
});

afterAll(async () => {
  await db.thread.deleteMany({ where: { listingId: { in: listingIds } } });
  await db.review.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.favorite.deleteMany({ where: { listingId: { in: listingIds } } });
  await db.order.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.buyer.deleteMany({ where: { id: { in: buyerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  await db.group.deleteMany({ where: { id: { in: groupIds } } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

// ---------------------------------------------------------------------------

describe("the overview", () => {
  it("counts only this seller's own data, once each", async () => {
    const seller = await mkSeller("ov");
    const other = await mkSeller("ov-other");
    const buyer = await mkBuyer("ov");
    const b2 = await mkBuyer("ov-2");

    // orders: placed 1, confirmed 2 (one with a pending cancellation), completed 1, cancelled 1, refused 1
    await mkOrder(buyer, seller.sellerId, "placed");
    await mkOrder(buyer, seller.sellerId, "confirmed");
    await mkOrder(b2, seller.sellerId, "confirmed", { pending: true });
    await mkOrder(buyer, seller.sellerId, "completed");
    await mkOrder(buyer, seller.sellerId, "cancelled");
    await mkOrder(buyer, seller.sellerId, "refused");
    // listings: the completed one is sold, the cancelled and refused ones are back on sale
    const extra = [await mkListing(seller.sellerId, "published"), await mkListing(seller.sellerId, "published"), await mkListing(seller.sellerId, "draft"), await mkListing(seller.sellerId, "archived")];
    // favourites over every own listing, whatever its status
    await db.favorite.createMany({ data: [extra[0], extra[2], extra[3]].map((l) => ({ buyerId: buyer.buyerId!, listingId: l.id })) });
    await db.favorite.create({ data: { buyerId: b2.buyerId!, listingId: extra[0].id } });
    // unread messages: two from a buyer, one the seller wrote
    const { threadId } = await startThread(db, buyer, { listingCode: extra[0].code, body: "one" });
    await db.message.create({ data: { threadId, senderRole: "buyer", senderUserId: buyer.userId, body: "two" } });
    await db.message.create({ data: { threadId, senderRole: "seller", senderUserId: seller.actor.userId, body: "reply" } });
    // reviews: 3 shown, 1 hidden
    for (const rating of [5, 5, 2]) await createReview(db, buyer, { sellerId: seller.sellerId, rating });
    const hidden = await createReview(db, buyer, { sellerId: seller.sellerId, rating: 1 });
    await hideReview(db, await mkRealStaff("ov"), hidden.id, "spam");
    await adjustCredits(db, { sellerId: seller.sellerId, amount: 9, note: "test", createdBy: null });
    // another seller's data must not leak in
    await mkOrder(buyer, other.sellerId, "placed");
    await mkListing(other.sellerId, "published");

    const overview = await getSellerOverview(db, seller.actor);

    expect(overview).toMatchObject({
      openOrders: 3, // placed + 2 confirmed
      pendingCancellations: 1,
      unreadMessages: 2,
      activeListings: 7, // 3 reserved by open orders, 2 back on sale (cancelled, refused) and 2 published
      totalFavourites: 4,
      itemsSold: 1,
      credits: { balance: 9, low: false },
    });
    expect(overview.rating).toEqual({ count: 3, average: 4, isNew: false });
  });

  it("is all zeros for a seller with nothing yet, and warns about credits", async () => {
    const seller = await mkSeller("empty");
    expect(await getSellerOverview(db, seller.actor)).toEqual({
      openOrders: 0,
      pendingCancellations: 0,
      unreadMessages: 0,
      activeListings: 0,
      totalFavourites: 0,
      itemsSold: 0,
      rating: { count: 0, average: null, isNew: true },
      credits: { balance: 0, low: true },
    });
  });

  it("warns at 5 credits or fewer, not at 6", async () => {
    const seller = await mkSeller("low");
    await adjustCredits(db, { sellerId: seller.sellerId, amount: 5, note: "t", createdBy: null });
    expect((await getSellerOverview(db, seller.actor)).credits).toEqual({ balance: 5, low: true });
    await adjustCredits(db, { sellerId: seller.sellerId, amount: 1, note: "t", createdBy: null });
    expect((await getSellerOverview(db, seller.actor)).credits).toEqual({ balance: 6, low: false });
  });

  it("counts a cancellation whose 7 days are up as already approved", async () => {
    const seller = await mkSeller("overdue");
    const buyer = await mkBuyer("overdue");
    const start = new Date("2001-03-01T10:00:00Z");
    await mkOrder(buyer, seller.sellerId, "confirmed", { now: start, pending: true });

    const before = await getSellerOverview(db, seller.actor, new Date(start.getTime() + 6 * DAY));
    const after = await getSellerOverview(db, seller.actor, new Date(start.getTime() + 8 * DAY));

    expect([before.pendingCancellations, before.openOrders]).toEqual([1, 1]);
    expect([after.pendingCancellations, after.openOrders]).toEqual([0, 0]);
  });

  it("is for seller accounts only", async () => {
    for (const actor of [await mkBuyer("ov-role"), staff]) {
      await expect(getSellerOverview(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("the orders list and detail", () => {
  it("lists only this seller's orders, cancellation requests first and then newest, with the buyer's name and no address or phone", async () => {
    const seller = await mkSeller("ol");
    const other = await mkSeller("ol-other");
    const buyer = await mkBuyer("ol");
    const first = await mkOrder(buyer, seller.sellerId, "placed");
    await new Promise((r) => setTimeout(r, 5));
    const pending = await mkOrder(buyer, seller.sellerId, "confirmed", { pending: true });
    await new Promise((r) => setTimeout(r, 5));
    const newest = await mkOrder(buyer, seller.sellerId, "confirmed");
    await mkOrder(buyer, other.sellerId, "placed");

    const rows = await listSellerOrderRows(db, seller.actor, {});

    expect(rows.map((r) => r.code)).toEqual([pending.code, newest.code, first.code]);
    expect(rows[0]).toMatchObject({ cancellationPending: true, buyerName: S("Buyer ol"), status: "confirmed", itemPriceEur: "75" });
    expect(rows[0].autoApproveAt).toBeInstanceOf(Date);
    expect(rows[1].cancellationPending).toBe(false);
    expect(rows[2].listing).toMatchObject({ code: first.listing.code, photoUrl: "https://x/l.jpg" });
    const json = JSON.stringify(rows);
    expect(json).not.toContain("SECRET");
  });

  it("filters by status, shows how old an open order is, and what a cancelled one had reached", async () => {
    const seller = await mkSeller("of");
    const buyer = await mkBuyer("of");
    const start = new Date("2001-04-01T10:00:00Z");
    await mkOrder(buyer, seller.sellerId, "placed", { now: start });
    const done = await mkOrder(buyer, seller.sellerId, "completed", { now: start });
    const cancelled = await mkOrder(buyer, seller.sellerId, "cancelled", { now: start });
    const later = new Date(start.getTime() + 3 * DAY + 5 * 3600 * 1000);

    const all = await listSellerOrderRows(db, seller.actor, {}, later);
    expect(all.find((r) => r.status === "placed")?.ageDays).toBe(3);
    expect(all.find((r) => r.code === done.code)?.ageDays).toBeNull();
    expect(all.find((r) => r.code === cancelled.code)).toMatchObject({ status: "cancelled", lastReachedStatus: "confirmed" });

    expect((await listSellerOrderRows(db, seller.actor, { status: "completed" }, later)).map((r) => r.code)).toEqual([done.code]);
    expect(await listSellerOrderRows(db, seller.actor, { status: "refused" }, later)).toEqual([]);
  });

  it("shows the full delivery details and the buyer's phone on one order, with the item and the cancellation", async () => {
    const seller = await mkSeller("od");
    const buyer = await mkBuyer("od");
    const order = await mkOrder(buyer, seller.sellerId, "confirmed", { pending: true });

    const detail = await getSellerOrder(db, seller.actor, order.code);

    expect(detail).toMatchObject({
      code: order.code,
      status: "confirmed",
      address: { recipientName: "Recipient", phone: "+359 SECRET-PHONE", addressLine1: "SECRET-ADDRESS 5", city: "Sofia", postcode: "1000" },
      listing: { code: order.listing.code, condition: "used_good" },
      part: { name: order.listing.partName, categoryName: categoryA.name },
      cancellation: { state: "pending", reason: "found_elsewhere" },
      threadId: null,
    });
  });

  it("links the order to the conversation with its buyer once there is one", async () => {
    const seller = await mkSeller("ot");
    const buyer = await mkBuyer("ot");
    const order = await mkOrder(buyer, seller.sellerId, "confirmed");
    await startThreadWithOrderBuyer(db, seller.actor, { orderId: order.orderId, body: "Hello" });
    const threadId = (await db.thread.findFirstOrThrow({ where: { buyerId: buyer.buyerId!, sellerId: seller.sellerId } })).id;

    expect((await getSellerOrder(db, seller.actor, order.code))?.threadId).toBe(threadId);
  });

  it("does not show an order to another seller, a buyer or staff", async () => {
    const seller = await mkSeller("op");
    const other = await mkSeller("op-other");
    const buyer = await mkBuyer("op");
    const order = await mkOrder(buyer, seller.sellerId, "placed");

    expect(await getSellerOrder(db, other.actor, order.code)).toBeNull();
    expect(await getSellerOrder(db, seller.actor, "ORD-nope")).toBeNull();
    for (const actor of [buyer, staff]) {
      await expect(getSellerOrder(db, actor, order.code)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listSellerOrderRows(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("the listings list, the category breakdown and the detail", () => {
  it("lists every listing in all six statuses with favourites, category and price, and filters by status", async () => {
    const seller = await mkSeller("ll");
    const other = await mkSeller("ll-other");
    const buyer = await mkBuyer("ll");
    const statuses: ListingStatus[] = ["draft", "published", "reserved", "sold", "cancelled", "archived"];
    const made: Record<string, { id: string; code: string }> = {};
    for (const status of statuses) {
      made[status] = await mkListing(seller.sellerId, status, status === "draft" ? categoryB : categoryA);
      await new Promise((r) => setTimeout(r, 5));
    }
    await mkListing(other.sellerId, "published");
    await db.favorite.create({ data: { buyerId: buyer.buyerId!, listingId: made.sold.id } });

    const rows = await listSellerListings(db, seller.actor, {});

    expect(rows.map((r) => r.status).sort()).toEqual([...statuses].sort());
    expect(rows[0].code).toBe(made.archived.code); // newest first
    const sold = rows.find((r) => r.status === "sold");
    expect(sold).toMatchObject({ code: made.sold.code, favourites: 1, priceEur: "75", categoryName: categoryA.name, photoUrl: "https://x/l.jpg" });
    expect(rows.find((r) => r.status === "draft")).toMatchObject({ categoryName: categoryB.name, publishedAt: null });
    expect(rows.find((r) => r.status === "published")?.publishedAt).toBeInstanceOf(Date);

    expect((await listSellerListings(db, seller.actor, { status: "archived" })).map((r) => r.code)).toEqual([made.archived.code]);
  });

  it("counts the listings on the shelf by group, and nothing else", async () => {
    const seller = await mkSeller("bd");
    for (const status of ["published", "published", "reserved"] as const) await mkListing(seller.sellerId, status, categoryA);
    await mkListing(seller.sellerId, "published", categoryB);
    for (const status of ["draft", "sold", "cancelled", "archived"] as const) await mkListing(seller.sellerId, status, categoryB);

    expect(await getCategoryBreakdown(db, seller.actor)).toEqual([
      { groupName: categoryA.groupName, count: 3 },
      { groupName: categoryB.groupName, count: 1 },
    ]);
    expect(await getCategoryBreakdown(db, (await mkSeller("bd-empty")).actor)).toEqual([]);
  });

  it("shows one listing read-only, in any status, with its donor car, a masked VIN and three counts", async () => {
    const seller = await mkSeller("ld");
    const buyer = await mkBuyer("ld");
    const listing = await mkListing(seller.sellerId, "reserved", categoryA, { vin: "WVWZZZ1KZAW123456" });
    await db.listingDefect.create({ data: { listingId: listing.id, description: "Crack on the cover", displayOrder: 0 } });
    await db.favorite.create({ data: { buyerId: buyer.buyerId!, listingId: listing.id } });
    await db.order.create({
      data: { internalCode: S("ORD-ld"), buyerId: buyer.buyerId!, sellerId: seller.sellerId, listingId: listing.id, itemPriceEur: "75.00", recipientName: "R", phone: "1", addressLine1: "a", city: "c", postcode: "p" },
    });
    await startThread(db, buyer, { listingCode: listing.code, body: "hi" });

    const detail = await getSellerListing(db, seller.actor, listing.code);

    expect(detail).toMatchObject({
      code: listing.code,
      status: "reserved",
      priceEur: "75",
      condition: "used_good",
      conditionNotes: "Minor scuffs",
      defects: ["Crack on the cover"],
      part: { name: listing.partName, categoryName: categoryA.name, groupName: categoryA.groupName },
      donor: { year: 2012, makeName: S("Mk"), modelGroupName: S("Model"), generationLabel: S("Gen") },
      counts: { favourites: 1, orders: 1, activeThreads: 1 },
    });
    expect(detail?.photos).toEqual([{ url: "https://x/l.jpg", caption: null }]);
    expect(detail?.donor.maskedVin).toMatch(/^WVW•+3456$/);
    expect(JSON.stringify(detail)).not.toContain("WVWZZZ1KZAW123456");
  });

  it("shows a draft to its seller, and no listing to another seller, a buyer or staff", async () => {
    const seller = await mkSeller("lp");
    const other = await mkSeller("lp-other");
    const draft = await mkListing(seller.sellerId, "draft");

    expect((await getSellerListing(db, seller.actor, draft.code))?.status).toBe("draft");
    expect(await getSellerListing(db, other.actor, draft.code)).toBeNull();
    expect(await getSellerListing(db, seller.actor, "LST-nope")).toBeNull();
    for (const actor of [await mkBuyer("lp"), staff]) {
      await expect(getSellerListing(db, actor, draft.code)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listSellerListings(db, actor, {})).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getCategoryBreakdown(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("the store details", () => {
  it("shows the seller's own public profile as buyers see it, without contact email or street address", async () => {
    const seller = await mkSeller("st");
    const oldest = new Date("2026-01-15T10:00:00Z");
    await mkListing(seller.sellerId, "published", categoryA, { publishedAt: new Date("2026-03-01T10:00:00Z") });
    await mkListing(seller.sellerId, "sold", categoryA, { publishedAt: oldest });
    const buyer = await mkBuyer("st");
    for (const rating of [5, 4, 4]) await createReview(db, buyer, { sellerId: seller.sellerId, rating });

    const store = await getStoreDetails(db, seller.actor);

    expect(store).toMatchObject({
      name: S("Seller st"),
      avatarUrl: "https://x/avatar.jpg",
      city: "Plovdiv",
      country: "BG",
      phone: "+359 88 000 1234",
      onIvoSince: oldest,
      rating: { count: 3, average: 4.3, isNew: false },
    });
    const json = JSON.stringify(store);
    expect(json).not.toContain("SECRET");
  });

  it("has no start date before anything is published, and is for seller accounts only", async () => {
    const seller = await mkSeller("st-new");
    expect((await getStoreDetails(db, seller.actor)).onIvoSince).toBeNull();
    for (const actor of [await mkBuyer("st-role"), staff]) {
      await expect(getStoreDetails(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});
