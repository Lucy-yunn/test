import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import { adjustCredits, getCreditSummary } from "./credits";
import {
  reserveListing,
  confirmOrder,
  completeOrder,
  refuseOrder,
  cancelOrder,
  approveCancellation,
  sweepOverdueCancellations,
  getBuyerOrder,
  listBuyerOrders,
  listSellerOrders,
  listOrdersForStaff,
} from "./orders";

/**
 * Orders (docs/order-model.md, ADR-0005, ADR-0009): the reserve action, the seller-operated
 * lifecycle, cancellation in its two paths, and who can see what. Real local Postgres.
 */
const TAG = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;
const DAY = 24 * 60 * 60 * 1000;

let generationId: string;
let categoryId: string;
const userIds: string[] = [];
const sellerIds: string[] = [];
const buyerIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

const ADDRESS = {
  recipientName: "Ivan Petrov",
  phone: "+359 88 111 2222",
  addressLine1: "12 Vitosha Blvd",
  addressLine2: "Floor 3",
  city: "Sofia",
  postcode: "1000",
};

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  buyerIds.push(buyer.id);
  return { userId: user.id, role: "buyer", buyerId: buyer.id, sellerId: null, messagingBlocked: false };
}

type Login = "active" | "banned" | "none";

async function mkSeller(label: string, login: Login = "active"): Promise<{ actor: Actor; sellerId: string; userId: string | null }> {
  let userId: string | null = null;
  if (login !== "none") {
    const user = await db.user.create({
      data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "seller", banned: login === "banned" },
    });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: { displayName: S(label), contactName: "C", contactEmail: `${label}-${TAG}@x.test`, contactPhone: "+359 88 000 0000", locationCity: "Plovdiv", userId },
  });
  sellerIds.push(seller.id);
  return {
    sellerId: seller.id,
    userId,
    actor: { userId: userId ?? "none", role: "seller", buyerId: null, sellerId: seller.id, messagingBlocked: false },
  };
}

const staff: Actor = { userId: "staff-x", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

async function mkListing(sellerId: string, status: "published" | "draft" | "reserved" | "sold" = "published", price = "80.00") {
  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S(`car-${donorIds.length}`) } });
  donorIds.push(donor.id);
  const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`part-${partIds.length}`) } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: part.id,
      donorVehicleId: donor.id,
      sellerId,
      priceEur: price,
      condition: "used_good",
      status,
      publishedAt: status === "draft" ? null : new Date(),
      noVisiblePartNumber: true,
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(listing.id);
  return { id: listing.id, code: listing.internalCode };
}

const listingStatus = async (id: string) => (await db.listing.findUniqueOrThrow({ where: { id } })).status;
const orderRow = (id: string) => db.order.findUniqueOrThrow({ where: { id }, include: { cancellationRequest: true } });

/** A seller, a buyer and a listing already reserved by that buyer. */
async function placedOrder(label: string, opts: { now?: Date; credits?: number } = {}) {
  const seller = await mkSeller(`s-${label}`);
  if (opts.credits) await adjustCredits(db, { sellerId: seller.sellerId, amount: opts.credits, note: "test", createdBy: null });
  const buyer = await mkBuyer(`b-${label}`);
  const listing = await mkListing(seller.sellerId);
  const { orderId } = await reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS }, opts.now);
  return { seller, buyer, listing, orderId };
}

async function confirmedOrder(label: string, opts: { now?: Date; credits?: number } = {}) {
  const o = await placedOrder(label, opts);
  await confirmOrder(db, o.seller.actor, o.orderId, opts.now);
  return o;
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 960 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  await db.order.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
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

describe("reserving a part", () => {
  it("creates a placed order with a price and address snapshot, and holds the listing", async () => {
    const seller = await mkSeller("res-s");
    const buyer = await mkBuyer("res-b");
    const listing = await mkListing(seller.sellerId, "published", "125.50");

    const { orderId, internalCode } = await reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS });

    expect(internalCode).toMatch(/^ORD-\d{6}$/);
    const order = await orderRow(orderId);
    expect(order).toMatchObject({
      status: "placed",
      buyerId: buyer.buyerId,
      sellerId: seller.sellerId,
      listingId: listing.id,
      lastReachedStatus: null,
      recipientName: "Ivan Petrov",
      phone: "+359 88 111 2222",
      addressLine1: "12 Vitosha Blvd",
      addressLine2: "Floor 3",
      city: "Sofia",
      postcode: "1000",
      country: "BG",
    });
    expect(String(order.itemPriceEur)).toBe("125.5");
    expect(order.placedAt).toBeInstanceOf(Date);
    expect(await listingStatus(listing.id)).toBe("reserved");
  });

  it("keeps the price it was reserved at when the listing price changes later", async () => {
    const seller = await mkSeller("snap-s");
    const buyer = await mkBuyer("snap-b");
    const listing = await mkListing(seller.sellerId, "published", "40.00");
    const { orderId } = await reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS });

    await db.listing.update({ where: { id: listing.id }, data: { priceEur: "999.00" } });

    expect(String((await orderRow(orderId)).itemPriceEur)).toBe("40");
  });

  it("only a published listing can be reserved, otherwise there is no order", async () => {
    const seller = await mkSeller("state-s");
    const buyer = await mkBuyer("state-b");
    for (const status of ["draft", "reserved", "sold"] as const) {
      const listing = await mkListing(seller.sellerId, status);
      await expect(reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS })).rejects.toThrow(
        /no longer available/i,
      );
      expect(await db.order.count({ where: { listingId: listing.id } })).toBe(0);
    }
  });

  it("gives the part to the first of two buyers who reserve it at the same moment", async () => {
    const seller = await mkSeller("race-s");
    const a = await mkBuyer("race-a");
    const b = await mkBuyer("race-b");
    const listing = await mkListing(seller.sellerId);

    const results = await Promise.allSettled([
      reserveListing(db, a, { listingCode: listing.code, address: ADDRESS }),
      reserveListing(db, b, { listingCode: listing.code, address: ADDRESS }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(lost?.reason).toBeInstanceOf(InvariantError);
    expect(lost?.reason.message).toMatch(/no longer available/i);
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(1);
    expect(await listingStatus(listing.id)).toBe("reserved");
  });

  it("is for buyer accounts only", async () => {
    const seller = await mkSeller("role-s");
    const listing = await mkListing(seller.sellerId);
    for (const actor of [seller.actor, staff]) {
      await expect(reserveListing(db, actor, { listingCode: listing.code, address: ADDRESS })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }
    expect(await listingStatus(listing.id)).toBe("published");
  });

  it.each<Login>(["none", "banned"])("is refused when the seller's login is %s", async (login) => {
    const seller = await mkSeller(`unavail-${login}`, login);
    const buyer = await mkBuyer(`unavail-b-${login}`);
    const listing = await mkListing(seller.sellerId);

    await expect(reserveListing(db, buyer, { listingCode: listing.code, address: ADDRESS })).rejects.toThrow(
      /temporarily unavailable/i,
    );

    expect(await listingStatus(listing.id)).toBe("published");
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("needs a complete delivery address, and nothing changes without one", async () => {
    const seller = await mkSeller("addr-s");
    const buyer = await mkBuyer("addr-b");
    const listing = await mkListing(seller.sellerId);
    for (const missing of ["recipientName", "phone", "addressLine1", "city", "postcode"] as const) {
      const address = { ...ADDRESS, [missing]: "   " };
      await expect(reserveListing(db, buyer, { listingCode: listing.code, address })).rejects.toBeInstanceOf(InvariantError);
    }
    expect(await listingStatus(listing.id)).toBe("published");
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("trims the address and treats a blank second line as none", async () => {
    const seller = await mkSeller("trim-s");
    const buyer = await mkBuyer("trim-b");
    const listing = await mkListing(seller.sellerId);
    const { orderId } = await reserveListing(db, buyer, {
      listingCode: listing.code,
      address: { ...ADDRESS, recipientName: "  Ivan  ", addressLine2: "  ", country: "" },
    });
    expect(await orderRow(orderId)).toMatchObject({ recipientName: "Ivan", addressLine2: null, country: "BG" });
  });

  it("says so when the listing does not exist", async () => {
    const buyer = await mkBuyer("nolisting");
    await expect(reserveListing(db, buyer, { listingCode: "LST-nope", address: ADDRESS })).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------

describe("the seller operates the order", () => {
  it("confirming keeps the listing reserved and stamps the time", async () => {
    const o = await placedOrder("conf");

    await confirmOrder(db, o.seller.actor, o.orderId);

    expect(await orderRow(o.orderId)).toMatchObject({ status: "confirmed" });
    expect((await orderRow(o.orderId)).confirmedAt).toBeInstanceOf(Date);
    expect(await listingStatus(o.listing.id)).toBe("reserved");
  });

  it("only the seller who owns the order can act on it, never the buyer, another seller or staff", async () => {
    const o = await placedOrder("own");
    const other = await mkSeller("own-other");
    for (const actor of [o.buyer, other.actor, staff]) {
      await expect(confirmOrder(db, actor, o.orderId)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await orderRow(o.orderId)).status).toBe("placed");
  });

  it("cannot confirm the same order twice", async () => {
    const o = await confirmedOrder("twice");
    await expect(confirmOrder(db, o.seller.actor, o.orderId)).rejects.toBeInstanceOf(InvariantError);
  });

  it("completing sells the listing", async () => {
    const o = await confirmedOrder("done");

    await completeOrder(db, o.seller.actor, o.orderId);

    expect(await orderRow(o.orderId)).toMatchObject({ status: "completed" });
    expect((await orderRow(o.orderId)).completedAt).toBeInstanceOf(Date);
    expect(await listingStatus(o.listing.id)).toBe("sold");
  });

  it("cannot complete or refuse an order that is still only placed", async () => {
    const o = await placedOrder("early");
    await expect(completeOrder(db, o.seller.actor, o.orderId)).rejects.toBeInstanceOf(InvariantError);
    await expect(refuseOrder(db, o.seller.actor, o.orderId, {})).rejects.toBeInstanceOf(InvariantError);
    expect(await listingStatus(o.listing.id)).toBe("reserved");
  });

  it("refusing puts the listing back on sale at no cost, and another buyer can reserve it again", async () => {
    const o = await confirmedOrder("refuse", { credits: 3 });
    const before = await getCreditSummary(db, o.seller.sellerId);

    await refuseOrder(db, o.seller.actor, o.orderId, { note: "  Buyer declined at the courier  " });

    expect(await orderRow(o.orderId)).toMatchObject({ status: "refused", refusalNote: "Buyer declined at the courier" });
    expect((await orderRow(o.orderId)).refusedAt).toBeInstanceOf(Date);
    expect(await listingStatus(o.listing.id)).toBe("published");
    expect(await getCreditSummary(db, o.seller.sellerId)).toEqual(before); // no new charge

    const next = await mkBuyer("refuse-next");
    await expect(reserveListing(db, next, { listingCode: o.listing.code, address: ADDRESS })).resolves.toBeDefined();
    expect(await db.order.count({ where: { listingId: o.listing.id } })).toBe(2);
  });

  it("a refusal note is optional", async () => {
    const o = await confirmedOrder("refuse-plain");
    await refuseOrder(db, o.seller.actor, o.orderId, {});
    expect((await orderRow(o.orderId)).refusalNote).toBeNull();
  });

  it("nothing leaves a terminal state", async () => {
    const o = await confirmedOrder("terminal");
    await completeOrder(db, o.seller.actor, o.orderId);
    await expect(refuseOrder(db, o.seller.actor, o.orderId, {})).rejects.toBeInstanceOf(InvariantError);
    await expect(confirmOrder(db, o.seller.actor, o.orderId)).rejects.toBeInstanceOf(InvariantError);
    await expect(cancelOrder(db, o.buyer, o.orderId, { reason: "no_longer_needed" })).rejects.toBeInstanceOf(InvariantError);
  });
});

// ---------------------------------------------------------------------------

describe("cancelling", () => {
  it("a placed order is cancelled at once, with the reason recorded, and the listing goes back on sale", async () => {
    const o = await placedOrder("cx-placed", { credits: 2 });
    const before = await getCreditSummary(db, o.seller.sellerId);

    await cancelOrder(db, o.buyer, o.orderId, { reason: "found_elsewhere" });

    const order = await orderRow(o.orderId);
    expect(order).toMatchObject({ status: "cancelled", lastReachedStatus: "placed" });
    expect(order.cancelledAt).toBeInstanceOf(Date);
    expect(order.cancellationRequest).toMatchObject({
      reason: "found_elsewhere",
      state: "approved",
      resolvedBy: "buyer",
    });
    expect(order.cancellationRequest?.resolvedAt).toBeInstanceOf(Date);
    expect(await listingStatus(o.listing.id)).toBe("published");
    expect(await getCreditSummary(db, o.seller.sellerId)).toEqual(before);
  });

  it("a confirmed order only gets a pending request that auto-approves 7 days later, and stays reserved", async () => {
    const now = new Date("2026-09-01T10:00:00Z");
    const o = await confirmedOrder("cx-conf", { now });

    await cancelOrder(db, o.buyer, o.orderId, { reason: "seller_too_slow" }, now);

    const order = await orderRow(o.orderId);
    expect(order.status).toBe("confirmed");
    expect(order.cancellationRequest).toMatchObject({ state: "pending", reason: "seller_too_slow", resolvedBy: null });
    expect(order.cancellationRequest?.autoApproveAt).toEqual(new Date(now.getTime() + 7 * DAY));
    expect(await listingStatus(o.listing.id)).toBe("reserved");
  });

  it("'other' needs a written reason, any other reason does not", async () => {
    const a = await placedOrder("cx-other-a");
    await expect(cancelOrder(db, a.buyer, a.orderId, { reason: "other" })).rejects.toBeInstanceOf(InvariantError);
    await expect(cancelOrder(db, a.buyer, a.orderId, { reason: "other", detail: "   " })).rejects.toBeInstanceOf(InvariantError);
    expect((await orderRow(a.orderId)).status).toBe("placed");

    await cancelOrder(db, a.buyer, a.orderId, { reason: "other", detail: "  My car was sold  " });
    expect((await orderRow(a.orderId)).cancellationRequest).toMatchObject({ reason: "other", reasonDetail: "My car was sold" });

    const b = await placedOrder("cx-other-b");
    await cancelOrder(db, b.buyer, b.orderId, { reason: "ordered_by_mistake", detail: "  " });
    expect((await orderRow(b.orderId)).cancellationRequest?.reasonDetail).toBeNull();
  });

  it("allows one request per order", async () => {
    const o = await confirmedOrder("cx-once");
    await cancelOrder(db, o.buyer, o.orderId, { reason: "no_longer_needed" });
    await expect(cancelOrder(db, o.buyer, o.orderId, { reason: "no_longer_needed" })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.cancellationRequest.count({ where: { orderId: o.orderId } })).toBe(1);
  });

  it("only the buyer who placed the order can cancel it", async () => {
    const o = await placedOrder("cx-own");
    const stranger = await mkBuyer("cx-stranger");
    for (const actor of [stranger, o.seller.actor, staff]) {
      await expect(cancelOrder(db, actor, o.orderId, { reason: "no_longer_needed" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await orderRow(o.orderId)).status).toBe("placed");
  });

  it("cannot cancel an order that is already over", async () => {
    const refused = await confirmedOrder("cx-refused");
    await refuseOrder(db, refused.seller.actor, refused.orderId, {});
    await expect(cancelOrder(db, refused.buyer, refused.orderId, { reason: "no_longer_needed" })).rejects.toBeInstanceOf(InvariantError);

    const cancelled = await placedOrder("cx-cancelled");
    await cancelOrder(db, cancelled.buyer, cancelled.orderId, { reason: "no_longer_needed" });
    await expect(cancelOrder(db, cancelled.buyer, cancelled.orderId, { reason: "no_longer_needed" })).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("a pending cancellation", () => {
  it("blocks the seller from completing or refusing until it is resolved", async () => {
    const o = await confirmedOrder("pend-block");
    await cancelOrder(db, o.buyer, o.orderId, { reason: "no_longer_needed" });

    await expect(completeOrder(db, o.seller.actor, o.orderId)).rejects.toThrow(/cancellation/i);
    await expect(refuseOrder(db, o.seller.actor, o.orderId, {})).rejects.toThrow(/cancellation/i);

    expect((await orderRow(o.orderId)).status).toBe("confirmed");
    expect(await listingStatus(o.listing.id)).toBe("reserved");
  });

  it("is approved by the seller: the order is cancelled, it remembers it had been confirmed, and the listing is on sale again", async () => {
    const o = await confirmedOrder("pend-approve", { credits: 2 });
    const before = await getCreditSummary(db, o.seller.sellerId);
    await cancelOrder(db, o.buyer, o.orderId, { reason: "found_elsewhere" });

    await approveCancellation(db, o.seller.actor, o.orderId);

    const order = await orderRow(o.orderId);
    expect(order).toMatchObject({ status: "cancelled", lastReachedStatus: "confirmed" });
    expect(order.cancelledAt).toBeInstanceOf(Date);
    expect(order.cancellationRequest).toMatchObject({ state: "approved", resolvedBy: "seller" });
    expect(await listingStatus(o.listing.id)).toBe("published");
    expect(await getCreditSummary(db, o.seller.sellerId)).toEqual(before);
  });

  it("can only be approved by the owning seller, and only when there is one", async () => {
    const o = await confirmedOrder("pend-who");
    await expect(approveCancellation(db, o.seller.actor, o.orderId)).rejects.toBeInstanceOf(InvariantError); // nothing pending

    await cancelOrder(db, o.buyer, o.orderId, { reason: "no_longer_needed" });
    const other = await mkSeller("pend-other");
    for (const actor of [o.buyer, other.actor, staff]) {
      await expect(approveCancellation(db, actor, o.orderId)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await orderRow(o.orderId)).status).toBe("confirmed");
  });
});

describe("the 7-day automatic approval", () => {
  const start = new Date("2026-09-01T10:00:00Z");

  async function pending(label: string) {
    const o = await confirmedOrder(label, { now: start });
    await cancelOrder(db, o.buyer, o.orderId, { reason: "seller_too_slow" }, start);
    return o;
  }

  it("does nothing before the deadline, and approves at the deadline itself", async () => {
    const o = await pending("sweep-edge");
    const deadline = new Date(start.getTime() + 7 * DAY);

    await sweepOverdueCancellations(db, new Date(deadline.getTime() - 1));
    expect((await orderRow(o.orderId)).status).toBe("confirmed");

    await sweepOverdueCancellations(db, deadline);

    const order = await orderRow(o.orderId);
    expect(order).toMatchObject({ status: "cancelled", lastReachedStatus: "confirmed" });
    expect(order.cancellationRequest).toMatchObject({ state: "approved", resolvedBy: "auto" });
    expect(await listingStatus(o.listing.id)).toBe("published");
  });

  it("returns how many it approved, leaves other orders alone, and is safe to repeat", async () => {
    const overdue = await pending("sweep-a");
    const fresh = await confirmedOrder("sweep-b", { now: start });
    await cancelOrder(db, fresh.buyer, fresh.orderId, { reason: "no_longer_needed" }, new Date(start.getTime() + 6 * DAY));
    const untouched = await confirmedOrder("sweep-c", { now: start }); // no request at all
    const now = new Date(start.getTime() + 7 * DAY + 1000);

    const first = await sweepOverdueCancellations(db, now);
    const second = await sweepOverdueCancellations(db, now);

    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);
    expect((await orderRow(overdue.orderId)).status).toBe("cancelled");
    expect((await orderRow(fresh.orderId)).status).toBe("confirmed");
    expect((await orderRow(untouched.orderId)).status).toBe("confirmed");
  });

  it("is also applied when the buyer or the seller opens their orders", async () => {
    const o = await pending("sweep-lazy");
    const later = new Date(start.getTime() + 8 * DAY);

    const view = await getBuyerOrder(db, o.buyer, (await orderRow(o.orderId)).internalCode, later);
    expect(view?.status).toBe("cancelled");

    const p2 = await pending("sweep-lazy-2");
    const rows = await listSellerOrders(db, p2.seller.actor, later);
    expect(rows.map((r) => r.status)).toEqual(["cancelled"]);
  });
});

// ---------------------------------------------------------------------------

describe("who sees which orders", () => {
  it("a buyer sees their own order with the item, the address snapshot and the seller, and nobody else does", async () => {
    const o = await confirmedOrder("vis-buyer");
    const code = (await orderRow(o.orderId)).internalCode;

    const view = await getBuyerOrder(db, o.buyer, code);

    expect(view).toMatchObject({
      code,
      status: "confirmed",
      itemPriceEur: "80",
      address: { recipientName: "Ivan Petrov", city: "Sofia", postcode: "1000" },
      listing: { code: o.listing.code, condition: "used_good", photoUrl: "https://x/p.jpg" },
      seller: { id: o.seller.sellerId, city: "Plovdiv", available: true, contact: { kind: "phone", phone: "+359 88 000 0000" } },
      cancellation: null,
    });
    const stranger = await mkBuyer("vis-stranger");
    expect(await getBuyerOrder(db, stranger, code)).toBeNull();
    expect(await getBuyerOrder(db, o.seller.actor, code)).toBeNull();
    expect(await getBuyerOrder(db, staff, code)).toBeNull();
  });

  it("never gives a buyer the seller's street address", async () => {
    const o = await placedOrder("vis-street");
    await db.seller.update({ where: { id: o.seller.sellerId }, data: { locationLine1: "SECRET-YARD-STREET 9" } });
    const view = await getBuyerOrder(db, o.buyer, (await orderRow(o.orderId)).internalCode);
    expect(JSON.stringify(view)).not.toContain("SECRET-YARD-STREET");
  });

  it("lists a buyer's own orders, newest first", async () => {
    const seller = await mkSeller("vis-list-s");
    const buyer = await mkBuyer("vis-list-b");
    const first = await mkListing(seller.sellerId);
    const second = await mkListing(seller.sellerId);
    await reserveListing(db, buyer, { listingCode: first.code, address: ADDRESS });
    await new Promise((r) => setTimeout(r, 5));
    await reserveListing(db, buyer, { listingCode: second.code, address: ADDRESS });

    const rows = await listBuyerOrders(db, buyer);

    expect(rows.map((r) => r.listing.code)).toEqual([second.code, first.code]);
    expect(await listBuyerOrders(db, await mkBuyer("vis-list-other"))).toEqual([]);
  });

  it("a seller sees their own orders with the buyer's name, phone and address, and no other seller does", async () => {
    const o = await placedOrder("vis-seller");

    const rows = await listSellerOrders(db, o.seller.actor);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "placed",
      address: { recipientName: "Ivan Petrov", phone: "+359 88 111 2222", addressLine1: "12 Vitosha Blvd" },
      listing: { code: o.listing.code },
    });
    const other = await mkSeller("vis-seller-other");
    expect(await listSellerOrders(db, other.actor)).toEqual([]);
    await expect(listSellerOrders(db, o.buyer)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listSellerOrders(db, staff)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("staff see every order read-only, with how old the open ones are and why one was cancelled", async () => {
    const start = new Date("2026-09-01T10:00:00Z");
    const open = await confirmedOrder("vis-staff-open", { now: start });
    const cx = await placedOrder("vis-staff-cx", { now: start });
    await cancelOrder(db, cx.buyer, cx.orderId, { reason: "found_elsewhere" }, start);

    const rows = await listOrdersForStaff(db, staff, new Date(start.getTime() + 3 * DAY + 5 * 60 * 60 * 1000));

    const openRow = rows.find((r) => r.id === open.orderId);
    const cxRow = rows.find((r) => r.id === cx.orderId);
    expect(openRow).toMatchObject({ status: "confirmed", ageDays: 3, sellerName: S("s-vis-staff-open") });
    expect(cxRow).toMatchObject({ status: "cancelled", ageDays: null, cancellation: { reason: "found_elsewhere" } });
    await expect(listOrdersForStaff(db, open.buyer, new Date())).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listOrdersForStaff(db, open.seller.actor, new Date())).rejects.toBeInstanceOf(ForbiddenError);
  });
});

