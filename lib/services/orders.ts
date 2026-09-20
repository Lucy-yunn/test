import type { Prisma, PrismaClient, CancellationReason, Condition, OrderStatus } from "@prisma/client";
import { isBuyer, isSeller, isStaff, type Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import { assertTransition, ORDER_TRANSITIONS } from "../dal/transitions";
import { SELLER_AVAILABILITY_SELECT, sellerIsAvailable } from "../dal/seller-availability";
import { blankToNull } from "../text";
import { nextInternalCode } from "./internal-code";
import { isUniqueViolation } from "./prisma-errors";
import { sellerContactFor, type SellerContact } from "./seller-contact";

/**
 * Orders (docs/order-model.md, ADR-0005, ADR-0009). Node-safe.
 *
 * An order is a buyer's reservation of exactly one listing. Payment is cash on delivery,
 * outside the platform, and the seller (never staff) operates the order. Every change to
 * an order runs in one transaction that first locks the order row, then reads its current
 * state, so two clicks or a click racing the daily sweep are applied one after the other
 * and the second sees what the first did. The only gate for reserving is the listing
 * moving `published -> reserved`, so the first of two buyers wins.
 *
 * Every function that changes time takes `now` (default: the real time) so the 7-day rule
 * can be tested at its exact boundary.
 */

export const CANCELLATION_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const NO_LONGER_AVAILABLE = "This item is no longer available";
const SELLER_UNAVAILABLE = "This seller is temporarily unavailable";

type Tx = Prisma.TransactionClient;
const OPEN: readonly OrderStatus[] = ["placed", "confirmed"];

// ---------------------------------------------------------------------------
// Reserve
// ---------------------------------------------------------------------------

export interface DeliveryAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postcode: string;
  country?: string | null;
}

interface CheckedAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  country: string;
}

function checkedAddress(a: DeliveryAddress): CheckedAddress {
  const required = (value: string, message: string) => {
    const v = blankToNull(value);
    if (!v) throw new InvariantError(message);
    return v;
  };
  return {
    recipientName: required(a.recipientName, "Enter the recipient's name"),
    phone: required(a.phone, "Enter a phone number"),
    addressLine1: required(a.addressLine1, "Enter the street address"),
    addressLine2: blankToNull(a.addressLine2),
    city: required(a.city, "Enter the city"),
    postcode: required(a.postcode, "Enter the postcode"),
    country: blankToNull(a.country) ?? "BG",
  };
}

/**
 * Reserve a published listing for a buyer: creates a `placed` order with the price and the
 * address written onto it, and holds the listing (`published -> reserved`).
 */
export async function reserveListing(
  db: PrismaClient,
  actor: Actor,
  input: { listingCode: string; address: DeliveryAddress },
  now: Date = new Date(),
): Promise<{ orderId: string; internalCode: string }> {
  if (!isBuyer(actor)) throw new ForbiddenError("Reserving is for buyer accounts");
  const address = checkedAddress(input.address);

  const listing = await db.listing.findUnique({
    where: { internalCode: input.listingCode },
    select: { id: true, status: true, priceEur: true, sellerId: true, seller: { select: SELLER_AVAILABILITY_SELECT } },
  });
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.status !== "published") throw new InvariantError(NO_LONGER_AVAILABLE);
  if (!sellerIsAvailable(listing.seller)) throw new InvariantError(SELLER_UNAVAILABLE);

  // The order code is max + 1, so two orders at once can pick the same one: retry then.
  for (let attempt = 0; attempt < 5; attempt++) {
    const internalCode = await nextInternalCode(db, "ORD");
    try {
      return await db.$transaction(async (tx) => {
        const held = await tx.listing.updateMany({
          where: { id: listing.id, status: "published" },
          data: { status: "reserved" },
        });
        if (held.count === 0) throw new InvariantError(NO_LONGER_AVAILABLE);

        const order = await tx.order.create({
          data: {
            internalCode,
            buyerId: actor.buyerId!,
            sellerId: listing.sellerId,
            listingId: listing.id,
            itemPriceEur: listing.priceEur,
            placedAt: now,
            ...address,
          },
          select: { id: true, internalCode: true },
        });
        return { orderId: order.id, internalCode: order.internalCode };
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new InvariantError("Could not allocate an order code, try again");
}

// ---------------------------------------------------------------------------
// Changing an order
// ---------------------------------------------------------------------------

/** Lock the order row, then read it, so what follows sees the latest committed state. */
async function lockAndLoad(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      buyerId: true,
      sellerId: true,
      listingId: true,
      cancellationRequest: { select: { id: true, state: true, autoApproveAt: true } },
    },
  });
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

type LockedOrder = Awaited<ReturnType<typeof lockAndLoad>>;

function assertSellerOwns(actor: Actor, order: LockedOrder): void {
  if (!isSeller(actor) || actor.sellerId !== order.sellerId) throw new ForbiddenError("Not your order");
}

function assertBuyerOwns(actor: Actor, order: LockedOrder): void {
  if (!isBuyer(actor) || actor.buyerId !== order.buyerId) throw new ForbiddenError("Not your order");
}

/** Put the listing of a finished or cancelled order back on sale. It costs the seller nothing. */
async function releaseListing(tx: Tx, listingId: string): Promise<void> {
  await tx.listing.updateMany({ where: { id: listingId, status: "reserved" }, data: { status: "published" } });
}

/** `placed -> confirmed`: the seller checked that the part exists and will hand it to the courier. */
export async function confirmOrder(db: PrismaClient, actor: Actor, orderId: string, now: Date = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await lockAndLoad(tx, orderId);
    assertSellerOwns(actor, order);
    assertTransition(ORDER_TRANSITIONS, order.status, "confirmed", "Order");
    await tx.order.update({ where: { id: orderId }, data: { status: "confirmed", confirmedAt: now } });
  });
}

/** A pending cancellation request has to be resolved before the seller can end the order. */
function assertNoPendingCancellation(order: LockedOrder): void {
  if (order.cancellationRequest?.state === "pending") {
    throw new InvariantError("The buyer has asked to cancel this order. Approve the cancellation request first.");
  }
}

/** `confirmed -> completed`: the buyer took the part and paid. The listing is sold. */
export async function completeOrder(db: PrismaClient, actor: Actor, orderId: string, now: Date = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await lockAndLoad(tx, orderId);
    assertSellerOwns(actor, order);
    assertTransition(ORDER_TRANSITIONS, order.status, "completed", "Order");
    assertNoPendingCancellation(order);
    await tx.order.update({ where: { id: orderId }, data: { status: "completed", completedAt: now } });
    await tx.listing.updateMany({ where: { id: order.listingId, status: "reserved" }, data: { status: "sold" } });
  });
}

/** `confirmed -> refused`: the buyer inspected the part at the courier and declined it. */
export async function refuseOrder(
  db: PrismaClient,
  actor: Actor,
  orderId: string,
  input: { note?: string | null },
  now: Date = new Date(),
): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await lockAndLoad(tx, orderId);
    assertSellerOwns(actor, order);
    assertTransition(ORDER_TRANSITIONS, order.status, "refused", "Order");
    assertNoPendingCancellation(order);
    await tx.order.update({
      where: { id: orderId },
      data: { status: "refused", refusedAt: now, refusalNote: blankToNull(input.note) },
    });
    await releaseListing(tx, order.listingId);
  });
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/** Approve a request and cancel its order. Shared by the buyer (instant), the seller and the sweep. */
async function cancelWithApproval(
  tx: Tx,
  order: LockedOrder,
  resolvedBy: "buyer" | "seller" | "auto",
  now: Date,
  requestId?: string,
): Promise<void> {
  if (requestId) {
    await tx.cancellationRequest.update({
      where: { id: requestId },
      data: { state: "approved", resolvedAt: now, resolvedBy },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: "cancelled", lastReachedStatus: order.status, cancelledAt: now },
  });
  await releaseListing(tx, order.listingId);
}

/**
 * The buyer cancels. While the order is `placed` it is instant (the seller has not committed
 * yet). Once `confirmed` it only raises a request that the seller approves, or that approves
 * itself after 7 days. Both paths store the reason in a `CancellationRequest`.
 */
export async function cancelOrder(
  db: PrismaClient,
  actor: Actor,
  orderId: string,
  input: { reason: CancellationReason; detail?: string | null },
  now: Date = new Date(),
): Promise<void> {
  const detail = blankToNull(input.detail);
  if (input.reason === "other" && !detail) throw new InvariantError("Tell us why you are cancelling");

  await db.$transaction(async (tx) => {
    const order = await lockAndLoad(tx, orderId);
    assertBuyerOwns(actor, order);
    if (!OPEN.includes(order.status)) throw new InvariantError("This order can no longer be cancelled");
    if (order.cancellationRequest) throw new InvariantError("A cancellation has already been requested for this order");

    const instant = order.status === "placed";
    await tx.cancellationRequest.create({
      data: {
        orderId,
        reason: input.reason,
        reasonDetail: detail,
        state: instant ? "approved" : "pending",
        createdAt: now,
        autoApproveAt: new Date(now.getTime() + CANCELLATION_WINDOW_DAYS * DAY_MS),
        ...(instant ? { resolvedAt: now, resolvedBy: "buyer" as const } : {}),
      },
    });
    // An instant cancellation was stored already approved; only the order and listing are left.
    if (instant) await cancelWithApproval(tx, order, "buyer", now);
  });
}

/** The seller approves a pending request: the order is cancelled and the listing is on sale again. */
export async function approveCancellation(db: PrismaClient, actor: Actor, orderId: string, now: Date = new Date()): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await lockAndLoad(tx, orderId);
    assertSellerOwns(actor, order);
    if (order.cancellationRequest?.state !== "pending") {
      throw new InvariantError("There is no pending cancellation request for this order");
    }
    await cancelWithApproval(tx, order, "seller", now, order.cancellationRequest.id);
  });
}

/**
 * Approve every pending request whose 7 days are up (`resolvedBy = auto`). Run by the daily
 * cron job, and by the pages that show orders, as a safety net. Safe to repeat. Returns how
 * many it approved. `scope` limits it to some orders, for the pages.
 */
export async function sweepOverdueCancellations(
  db: PrismaClient,
  now: Date = new Date(),
  scope: Prisma.OrderWhereInput = {},
): Promise<number> {
  const overdue = await db.cancellationRequest.findMany({
    where: { state: "pending", autoApproveAt: { lte: now }, order: scope },
    select: { orderId: true },
  });

  let approved = 0;
  for (const { orderId } of overdue) {
    await db.$transaction(async (tx) => {
      const order = await lockAndLoad(tx, orderId);
      const request = order.cancellationRequest;
      // Another request may have resolved it since the list was read.
      if (request?.state !== "pending" || request.autoApproveAt > now) return;
      await cancelWithApproval(tx, order, "auto", now, request.id);
      approved += 1;
    });
  }
  return approved;
}

// ---------------------------------------------------------------------------
// Reading orders
// ---------------------------------------------------------------------------

export interface OrderCancellationView {
  state: "pending" | "approved";
  reason: CancellationReason;
  reasonDetail: string | null;
  autoApproveAt: Date;
  resolvedAt: Date | null;
  resolvedBy: "buyer" | "seller" | "staff" | "auto" | null;
}

export interface OrderView {
  id: string;
  code: string;
  status: OrderStatus;
  lastReachedStatus: OrderStatus | null;
  itemPriceEur: string;
  refusalNote: string | null;
  placedAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  refusedAt: Date | null;
  cancelledAt: Date | null;
  /** The delivery address as it was when the order was placed. */
  address: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postcode: string;
    country: string;
  };
  listing: { code: string; title: string; condition: Condition; photoUrl: string | null };
  cancellation: OrderCancellationView | null;
}

export interface BuyerOrderView extends OrderView {
  /** Whether this order already has a review, so the page stops offering Leave a review. */
  reviewed: boolean;
  seller: {
    id: string;
    name: string;
    avatarUrl: string | null;
    city: string;
    /** False when the seller has no active login: the page shows the name without a profile link. */
    available: boolean;
    contact: SellerContact;
  };
}

export interface StaffOrderView extends OrderView {
  sellerName: string;
  /** Whole days since it was placed, for an order that is still open. Null once it is over. */
  ageDays: number | null;
}

/** What every order view reads. Shared with the seller center's order detail. */
export const orderSelect = {
  id: true,
  internalCode: true,
  status: true,
  lastReachedStatus: true,
  itemPriceEur: true,
  refusalNote: true,
  placedAt: true,
  confirmedAt: true,
  completedAt: true,
  refusedAt: true,
  cancelledAt: true,
  recipientName: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  postcode: true,
  country: true,
  cancellationRequest: {
    select: { state: true, reason: true, reasonDetail: true, autoApproveAt: true, resolvedAt: true, resolvedBy: true },
  },
  listing: {
    select: {
      internalCode: true,
      condition: true,
      part: { select: { name: true } },
      photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export function toView(o: OrderRow): OrderView {
  return {
    id: o.id,
    code: o.internalCode,
    status: o.status,
    lastReachedStatus: o.lastReachedStatus,
    itemPriceEur: String(o.itemPriceEur),
    refusalNote: o.refusalNote,
    placedAt: o.placedAt,
    confirmedAt: o.confirmedAt,
    completedAt: o.completedAt,
    refusedAt: o.refusedAt,
    cancelledAt: o.cancelledAt,
    address: {
      recipientName: o.recipientName,
      phone: o.phone,
      addressLine1: o.addressLine1,
      addressLine2: o.addressLine2,
      city: o.city,
      postcode: o.postcode,
      country: o.country,
    },
    listing: {
      code: o.listing.internalCode,
      title: o.listing.part.name,
      condition: o.listing.condition,
      photoUrl: o.listing.photos[0]?.url ?? null,
    },
    cancellation: o.cancellationRequest,
  };
}

const newestFirst = [{ placedAt: "desc" as const }, { id: "desc" as const }];

/** A buyer's own order by its code, or null when it is not theirs. */
export async function getBuyerOrder(
  db: PrismaClient,
  actor: Actor,
  orderCode: string,
  now: Date = new Date(),
): Promise<BuyerOrderView | null> {
  if (!isBuyer(actor)) return null;
  const mine = { internalCode: orderCode, buyerId: actor.buyerId! };
  await sweepOverdueCancellations(db, now, mine);

  const o = await db.order.findFirst({
    relationLoadStrategy: "join",
    where: mine,
    select: {
      ...orderSelect,
      review: { select: { id: true } },
      seller: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          locationCity: true,
          contactPhone: true,
          ...SELLER_AVAILABILITY_SELECT,
        },
      },
    },
  });
  if (!o) return null;

  return {
    ...toView(o),
    reviewed: o.review !== null,
    seller: {
      id: o.seller.id,
      name: o.seller.displayName,
      avatarUrl: o.seller.avatarUrl,
      city: o.seller.locationCity,
      available: sellerIsAvailable(o.seller),
      contact: sellerContactFor(actor, o.seller.contactPhone),
    },
  };
}

/** A buyer's own orders, newest first. */
export async function listBuyerOrders(db: PrismaClient, actor: Actor, now: Date = new Date()): Promise<OrderView[]> {
  if (!isBuyer(actor)) return [];
  const mine = { buyerId: actor.buyerId! };
  await sweepOverdueCancellations(db, now, mine);
  const rows = await db.order.findMany({ relationLoadStrategy: "join", where: mine, orderBy: newestFirst, select: orderSelect });
  return rows.map(toView);
}

/** A seller's own orders with the delivery snapshot they need to book the courier, newest first. */
export async function listSellerOrders(db: PrismaClient, actor: Actor, now: Date = new Date()): Promise<OrderView[]> {
  if (!isSeller(actor)) throw new ForbiddenError("Orders are for seller accounts");
  const mine = { sellerId: actor.sellerId! };
  await sweepOverdueCancellations(db, now, mine);
  const rows = await db.order.findMany({ relationLoadStrategy: "join", where: mine, orderBy: newestFirst, select: orderSelect });
  return rows.map(toView);
}

/** Every order, read-only, for the admin list. Staff cannot act on orders. */
export async function listOrdersForStaff(db: PrismaClient, actor: Actor, now: Date = new Date()): Promise<StaffOrderView[]> {
  if (!isStaff(actor)) throw new ForbiddenError("Staff only");
  await sweepOverdueCancellations(db, now);
  const rows = await db.order.findMany({
    relationLoadStrategy: "join",
    orderBy: newestFirst,
    select: { ...orderSelect, seller: { select: { displayName: true } } },
  });
  return rows.map((o) => ({
    ...toView(o),
    sellerName: o.seller.displayName,
    ageDays: OPEN.includes(o.status) ? Math.floor((now.getTime() - o.placedAt.getTime()) / DAY_MS) : null,
  }));
}
