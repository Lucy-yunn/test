import type { ListingStatus, Prisma, PrismaClient, SenderRole } from "@prisma/client";
import { isBuyer, isSeller, isStaff, type Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import { SELLER_AVAILABILITY_SELECT, sellerIsAvailable } from "../dal/seller-availability";
import { blankToNull } from "../text";
import { threadListingBadge, type ReservedBy } from "../thread-badge";
import { isUniqueViolation } from "./prisma-errors";

/**
 * In-app messaging (docs/messaging-model.md, ADR-0006). Node-safe.
 *
 * A thread is one buyer and one seller talking about one listing. Both must have a real
 * login. Messages are text only and never edited or deleted; staff moderate by locking a
 * thread, blocking a user, and posting as "IVO Support", never by rewriting history.
 *
 * Whether a user is blocked from messaging comes from the `Actor`, which is resolved from the
 * database on every request, so a block takes effect on the person's next request.
 */

export const MAX_MESSAGE_LENGTH = 4000;

const CLOSED_BY_IVO = "This conversation was closed by IVO.";
const BUYER_VISIBLE: readonly ListingStatus[] = ["published", "reserved"];
const OPEN_ORDER: readonly ("placed" | "confirmed")[] = ["placed", "confirmed"];

function checkedBody(body: string): string {
  const text = body.trim();
  if (!text) throw new InvariantError("Write a message first");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new InvariantError(`A message can be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return text;
}

function assertNotBlocked(actor: Actor): void {
  if (actor.messagingBlocked) throw new InvariantError("Messaging has been turned off for your account");
}

/**
 * Append a message and move the thread to the top. `sentAt` and `lastMessageAt` stay equal.
 * A new message also takes the thread out of both people's trash: the other side must see it,
 * and the sender is plainly not done with it.
 */
async function appendMessage(
  tx: Prisma.TransactionClient,
  threadId: string,
  sender: { userId: string; role: SenderRole },
  body: string,
): Promise<void> {
  const now = new Date();
  await tx.message.create({
    data: { threadId, senderRole: sender.role, senderUserId: sender.userId, body, sentAt: now },
  });
  await tx.thread.update({ where: { id: threadId }, data: { lastMessageAt: now, buyerTrashedAt: null, sellerTrashedAt: null } });
}

function assertStaff(actor: Actor): void {
  if (!isStaff(actor)) throw new ForbiddenError("Staff only");
}

// ---------------------------------------------------------------------------
// Starting and writing
// ---------------------------------------------------------------------------

/** The buyer's existing thread about a listing, or null when they have not written yet. */
export async function findThreadForListing(db: PrismaClient, actor: Actor, listingCode: string): Promise<string | null> {
  if (!isBuyer(actor)) return null;
  const thread = await db.thread.findFirst({
    where: { buyerId: actor.buyerId!, listing: { internalCode: listingCode } },
    select: { id: true },
  });
  return thread?.id ?? null;
}

/**
 * A buyer writes about a listing. The thread and its first message are created together, so
 * an empty thread never exists. When the buyer already has a thread for the listing, the
 * message goes into it.
 */
export async function startThread(
  db: PrismaClient,
  actor: Actor,
  input: { listingCode: string; body: string },
): Promise<{ threadId: string }> {
  if (!isBuyer(actor)) throw new ForbiddenError("Messaging a seller is for buyer accounts");
  const body = checkedBody(input.body);
  assertNotBlocked(actor);

  const listing = await db.listing.findUnique({
    where: { internalCode: input.listingCode },
    select: { id: true, status: true, sellerId: true, seller: { select: SELLER_AVAILABILITY_SELECT } },
  });
  if (!listing) throw new NotFoundError("Listing not found");
  if (!BUYER_VISIBLE.includes(listing.status)) throw new InvariantError("This item is no longer available");
  if (!sellerIsAvailable(listing.seller)) throw new InvariantError("Messaging isn't available for this seller");

  // Two starts at the same moment: one creates the thread, the other finds it on its retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.thread.findUnique({
          where: { listingId_buyerId: { listingId: listing.id, buyerId: actor.buyerId! } },
          select: { id: true, lockedAt: true },
        });
        if (existing) {
          if (existing.lockedAt) throw new InvariantError(CLOSED_BY_IVO);
          await appendMessage(tx, existing.id, { userId: actor.userId, role: "buyer" }, body);
          return { threadId: existing.id };
        }
        const now = new Date();
        const thread = await tx.thread.create({
          data: {
            listingId: listing.id,
            buyerId: actor.buyerId!,
            sellerId: listing.sellerId,
            createdAt: now,
            lastMessageAt: now,
            messages: { create: { senderRole: "buyer", senderUserId: actor.userId, body, sentAt: now } },
          },
          select: { id: true },
        });
        return { threadId: thread.id };
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new InvariantError("Could not start the conversation, try again");
}

/** The buyer's direct conversation with a seller (about no listing), or null when they have not written yet. */
export async function findDirectThread(db: PrismaClient, actor: Actor, sellerId: string): Promise<string | null> {
  if (!isBuyer(actor)) return null;
  const thread = await db.thread.findFirst({ where: { listingId: null, buyerId: actor.buyerId!, sellerId }, select: { id: true } });
  return thread?.id ?? null;
}

/**
 * A buyer writes to a seller about no listing in particular (docs/messaging-model.md section
 * 3.5). There is one such thread per buyer and seller, so writing again goes into it. The
 * thread and its first message are created together.
 */
export async function startDirectThread(
  db: PrismaClient,
  actor: Actor,
  input: { sellerId: string; body: string },
): Promise<{ threadId: string }> {
  if (!isBuyer(actor)) throw new ForbiddenError("Messaging a seller is for buyer accounts");
  const body = checkedBody(input.body);
  assertNotBlocked(actor);

  const seller = await db.seller.findUnique({ where: { id: input.sellerId }, select: SELLER_AVAILABILITY_SELECT });
  if (!seller) throw new NotFoundError("Seller not found");
  if (!sellerIsAvailable(seller)) throw new InvariantError("Messaging isn't available for this seller");

  // Two starts at the same moment: one creates the thread, the other finds it on its retry.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.thread.findFirst({
          where: { listingId: null, buyerId: actor.buyerId!, sellerId: input.sellerId },
          select: { id: true, lockedAt: true },
        });
        if (existing) {
          if (existing.lockedAt) throw new InvariantError(CLOSED_BY_IVO);
          await appendMessage(tx, existing.id, { userId: actor.userId, role: "buyer" }, body);
          return { threadId: existing.id };
        }
        const now = new Date();
        const thread = await tx.thread.create({
          data: {
            listingId: null,
            buyerId: actor.buyerId!,
            sellerId: input.sellerId,
            createdAt: now,
            lastMessageAt: now,
            messages: { create: { senderRole: "buyer", senderUserId: actor.userId, body, sentAt: now } },
          },
          select: { id: true },
        });
        return { threadId: thread.id };
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new InvariantError("Could not start the conversation, try again");
}

/** The thread between a seller and the buyer of one of their orders, about that order's listing. */
export async function findThreadForOrder(db: PrismaClient, actor: Actor, orderId: string): Promise<string | null> {
  if (!isSeller(actor)) return null;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { sellerId: true, buyerId: true, listingId: true } });
  if (!order || order.sellerId !== actor.sellerId) return null;
  const thread = await db.thread.findUnique({
    where: { listingId_buyerId: { listingId: order.listingId, buyerId: order.buyerId } },
    select: { id: true },
  });
  return thread?.id ?? null;
}

/**
 * A seller writes first to the buyer of one of their own orders, for example to talk before
 * approving a cancellation (docs/seller-center.md section 3.3). This is the only way a seller
 * starts a thread: the order already ties the two of them together. The thread and its first
 * message are created together, and an existing thread for that listing and buyer is reused.
 * It works whatever the listing's status, since the order exists.
 */
export async function startThreadWithOrderBuyer(
  db: PrismaClient,
  actor: Actor,
  input: { orderId: string; body: string },
): Promise<{ threadId: string }> {
  if (!isSeller(actor)) throw new ForbiddenError("Only the seller of an order can write to its buyer this way");
  const body = checkedBody(input.body);
  assertNotBlocked(actor);

  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { sellerId: true, buyerId: true, listingId: true } });
  if (!order) throw new NotFoundError("Order not found");
  if (order.sellerId !== actor.sellerId) throw new ForbiddenError("Not your order");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const existing = await tx.thread.findUnique({
          where: { listingId_buyerId: { listingId: order.listingId, buyerId: order.buyerId } },
          select: { id: true, lockedAt: true },
        });
        if (existing) {
          if (existing.lockedAt) throw new InvariantError(CLOSED_BY_IVO);
          await appendMessage(tx, existing.id, { userId: actor.userId, role: "seller" }, body);
          return { threadId: existing.id };
        }
        const now = new Date();
        const thread = await tx.thread.create({
          data: {
            listingId: order.listingId,
            buyerId: order.buyerId,
            sellerId: order.sellerId,
            createdAt: now,
            lastMessageAt: now,
            messages: { create: { senderRole: "seller", senderUserId: actor.userId, body, sentAt: now } },
          },
          select: { id: true },
        });
        return { threadId: thread.id };
      });
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }
  throw new InvariantError("Could not start the conversation, try again");
}

/** A buyer or seller in the thread replies. Refused while the thread is locked or the sender is blocked. */
export async function sendMessage(db: PrismaClient, actor: Actor, threadId: string, body: string): Promise<void> {
  if (!isBuyer(actor) && !isSeller(actor)) throw new ForbiddenError("Only the buyer and the seller can write here");

  await db.$transaction(async (tx) => {
    const thread = await tx.thread.findUnique({
      where: { id: threadId },
      select: { buyerId: true, sellerId: true, lockedAt: true },
    });
    if (!thread) throw new NotFoundError("Conversation not found");
    const isParty = isBuyer(actor) ? actor.buyerId === thread.buyerId : actor.sellerId === thread.sellerId;
    if (!isParty) throw new ForbiddenError("Not your conversation");

    const text = checkedBody(body);
    assertNotBlocked(actor);
    if (thread.lockedAt) throw new InvariantError(CLOSED_BY_IVO);
    await appendMessage(tx, threadId, { userId: actor.userId, role: actor.role as SenderRole }, text);
  });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface ThreadListItem {
  id: string;
  /** Null for a direct conversation, which is about no listing in particular. */
  listing: { code: string; title: string; photoUrl: string | null } | null;
  /** The seller's display name for a buyer, the buyer's name for a seller. */
  otherPartyName: string;
  /** The other person's id (the seller's for a buyer, the buyer's for a seller), to group by. */
  otherPartyId: string;
  lastMessage: { body: string; from: "me" | "them" | "support" } | null;
  lastMessageAt: Date;
  unread: number;
  locked: boolean;
  /** The other side wrote last (support messages do not count): this person owes the reply. */
  needsReply: boolean;
  /** In this person's own trash. */
  trashed: boolean;
}

export interface ThreadMessageView {
  id: string;
  body: string;
  sentAt: Date;
  /** "support" is a staff message, shown to both people as IVO Support and never as the seller. */
  from: "me" | "them" | "support";
}

export interface ThreadView {
  id: string;
  otherPartyName: string;
  /** Null for a direct conversation: there is no listing header. */
  listing: {
    code: string;
    title: string;
    priceEur: string;
    photoUrl: string | null;
    status: ListingStatus;
    badge: string | null;
  } | null;
  /** `open`, `locked` by staff, or `blocked` (this person may read but not write). */
  state: "open" | "locked" | "blocked";
  /** In this person's own trash. */
  trashed: boolean;
  reportedByMe: boolean;
  messages: ThreadMessageView[];
}

function fromViewer(role: SenderRole, viewerRole: "buyer" | "seller"): "me" | "them" | "support" {
  return role === "staff" ? "support" : role === viewerRole ? "me" : "them";
}

/** The threads a buyer or seller is in, most recently active first. */
export async function listThreads(db: PrismaClient, actor: Actor): Promise<ThreadListItem[]> {
  const viewerRole = isBuyer(actor) ? "buyer" : isSeller(actor) ? "seller" : null;
  if (!viewerRole) return [];

  const rows = await db.thread.findMany({
    where: viewerRole === "buyer" ? { buyerId: actor.buyerId! } : { sellerId: actor.sellerId! },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      lastMessageAt: true,
      lockedAt: true,
      buyerTrashedAt: true,
      sellerTrashedAt: true,
      listing: {
        select: {
          internalCode: true,
          part: { select: { name: true } },
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
        },
      },
      buyer: { select: { user: { select: { name: true } } } },
      seller: { select: { displayName: true } },
      messages: { orderBy: [{ sentAt: "desc" }, { id: "desc" }], take: 1, select: { body: true, senderRole: true } },
      _count: { select: { messages: { where: { readAt: null, senderUserId: { not: actor.userId } } } } },
    },
  });

  // Who wrote last, leaving support out: a support message does not answer anyone's question.
  const lastByAPerson = await db.message.findMany({
    where: { threadId: { in: rows.map((r) => r.id) }, senderRole: { not: "staff" } },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    distinct: ["threadId"],
    select: { threadId: true, senderRole: true },
  });
  const lastRole = new Map(lastByAPerson.map((m) => [m.threadId, m.senderRole]));
  const otherRole: SenderRole = viewerRole === "buyer" ? "seller" : "buyer";

  return rows.map((t) => ({
    id: t.id,
    listing: t.listing
      ? { code: t.listing.internalCode, title: t.listing.part.name, photoUrl: t.listing.photos[0]?.url ?? null }
      : null,
    otherPartyName: viewerRole === "buyer" ? t.seller.displayName : t.buyer.user.name,
    otherPartyId: viewerRole === "buyer" ? t.sellerId : t.buyerId,
    lastMessage: t.messages[0] ? { body: t.messages[0].body, from: fromViewer(t.messages[0].senderRole, viewerRole) } : null,
    lastMessageAt: t.lastMessageAt,
    unread: t._count.messages,
    locked: t.lockedAt !== null,
    needsReply: lastRole.get(t.id) === otherRole,
    trashed: (viewerRole === "buyer" ? t.buyerTrashedAt : t.sellerTrashedAt) !== null,
  }));
}

async function setTrashed(db: PrismaClient, actor: Actor, threadId: string, trashed: boolean): Promise<void> {
  if (!isBuyer(actor) && !isSeller(actor)) throw new ForbiddenError("Only the buyer and the seller can move a conversation");
  const thread = await db.thread.findUnique({ where: { id: threadId }, select: { buyerId: true, sellerId: true } });
  if (!thread) throw new NotFoundError("Conversation not found");
  const isParty = isBuyer(actor) ? actor.buyerId === thread.buyerId : actor.sellerId === thread.sellerId;
  if (!isParty) throw new ForbiddenError("Not your conversation");

  const column = isBuyer(actor) ? "buyerTrashedAt" : "sellerTrashedAt";
  await db.$transaction(async (tx) => {
    await tx.thread.update({ where: { id: threadId }, data: { [column]: trashed ? new Date() : null } });
    // What the person threw away should not keep showing on their unread badge.
    if (trashed) {
      await tx.message.updateMany({
        where: { threadId, readAt: null, senderUserId: { not: actor.userId } },
        data: { readAt: new Date() },
      });
    }
  });
}

/** Put a conversation in this person's own trash. The other side is not told and still sees it. */
export const moveToTrash = (db: PrismaClient, actor: Actor, threadId: string) => setTrashed(db, actor, threadId, true);

/** Take a conversation out of this person's trash. (A new message from the other side does it too.) */
export const restoreFromTrash = (db: PrismaClient, actor: Actor, threadId: string) => setTrashed(db, actor, threadId, false);

/** How many messages from the other side (or from support) this person has not opened yet. */
export async function getUnreadCount(db: PrismaClient, actor: Actor): Promise<number> {
  if (!isBuyer(actor) && !isSeller(actor)) return 0;
  return db.message.count({
    where: {
      readAt: null,
      senderUserId: { not: actor.userId },
      thread: isBuyer(actor) ? { buyerId: actor.buyerId! } : { sellerId: actor.sellerId! },
    },
  });
}

/**
 * Open a thread as one of its two people, or null when it is not theirs. Opening it marks the
 * other side's messages (and support's) as read. Staff read threads through the admin view,
 * which marks nothing.
 */
export async function getThread(db: PrismaClient, actor: Actor, threadId: string): Promise<ThreadView | null> {
  const viewerRole = isBuyer(actor) ? "buyer" : isSeller(actor) ? "seller" : null;
  if (!viewerRole) return null;

  const thread = await db.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      lockedAt: true,
      buyerTrashedAt: true,
      sellerTrashedAt: true,
      listing: {
        select: {
          internalCode: true,
          priceEur: true,
          status: true,
          part: { select: { name: true } },
          photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
          orders: { where: { status: { in: [...OPEN_ORDER] } }, take: 1, select: { buyerId: true } },
        },
      },
      buyer: { select: { user: { select: { name: true } } } },
      seller: { select: { displayName: true } },
      reports: { where: { reportedById: actor.userId, state: "open" }, select: { id: true } },
    },
  });
  if (!thread) return null;
  const isParty = viewerRole === "buyer" ? actor.buyerId === thread.buyerId : actor.sellerId === thread.sellerId;
  if (!isParty) return null;

  await db.message.updateMany({
    where: { threadId, readAt: null, senderUserId: { not: actor.userId } },
    data: { readAt: new Date() },
  });
  const messages = await db.message.findMany({
    where: { threadId },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    select: { id: true, body: true, sentAt: true, senderRole: true },
  });

  const listing = thread.listing;
  const reservedBy: ReservedBy =
    !listing || listing.status !== "reserved" || viewerRole === "seller"
      ? "none"
      : listing.orders[0]?.buyerId === actor.buyerId
        ? "viewer"
        : "someone_else";

  return {
    id: thread.id,
    otherPartyName: viewerRole === "buyer" ? thread.seller.displayName : thread.buyer.user.name,
    listing: listing
      ? {
          code: listing.internalCode,
          title: listing.part.name,
          priceEur: String(listing.priceEur),
          photoUrl: listing.photos[0]?.url ?? null,
          status: listing.status,
          badge: threadListingBadge(listing.status, reservedBy),
        }
      : null,
    state: thread.lockedAt ? "locked" : actor.messagingBlocked ? "blocked" : "open",
    trashed: (viewerRole === "buyer" ? thread.buyerTrashedAt : thread.sellerTrashedAt) !== null,
    reportedByMe: thread.reports.length > 0,
    messages: messages.map((m) => ({ id: m.id, body: m.body, sentAt: m.sentAt, from: fromViewer(m.senderRole, viewerRole) })),
  };
}

/** The seller's published and reserved listings, for the profile's "Which part is your message about?" picker. */
export async function listMessageableListings(db: PrismaClient, sellerId: string) {
  const rows = await db.listing.findMany({
    where: { sellerId, status: { in: [...BUYER_VISIBLE] } },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    select: {
      internalCode: true,
      priceEur: true,
      part: { select: { name: true } },
      photos: { orderBy: { displayOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  return rows.map((l) => ({
    code: l.internalCode,
    title: l.part.name,
    priceEur: String(l.priceEur),
    photoUrl: l.photos[0]?.url ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Either person flags the thread for staff. Reporting twice while a report is open changes nothing. */
export async function reportThread(db: PrismaClient, actor: Actor, threadId: string, reason?: string | null): Promise<void> {
  if (!isBuyer(actor) && !isSeller(actor)) throw new ForbiddenError("Only the buyer and the seller can report a conversation");
  const thread = await db.thread.findUnique({ where: { id: threadId }, select: { buyerId: true, sellerId: true } });
  if (!thread) throw new NotFoundError("Conversation not found");
  const isParty = isBuyer(actor) ? actor.buyerId === thread.buyerId : actor.sellerId === thread.sellerId;
  if (!isParty) throw new ForbiddenError("Not your conversation");

  const open = await db.report.findFirst({ where: { threadId, reportedById: actor.userId, state: "open" }, select: { id: true } });
  if (open) return;
  await db.report.create({
    data: { threadId, reportedById: actor.userId, reportedByRole: actor.role as SenderRole, reason: blankToNull(reason) },
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export interface StaffThreadListItem {
  id: string;
  /** Null for a direct conversation. */
  listing: { code: string; title: string } | null;
  buyerName: string;
  sellerName: string;
  lastMessageAt: Date;
  messageCount: number;
  openReports: number;
  locked: boolean;
}

/** Every thread, most recently active first. Threads are not private from the operator. */
export async function listThreadsForStaff(db: PrismaClient, actor: Actor): Promise<StaffThreadListItem[]> {
  assertStaff(actor);
  const rows = await db.thread.findMany({
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      lastMessageAt: true,
      lockedAt: true,
      listing: { select: { internalCode: true, part: { select: { name: true } } } },
      buyer: { select: { user: { select: { name: true } } } },
      seller: { select: { displayName: true } },
      _count: { select: { messages: true, reports: { where: { state: "open" } } } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    listing: t.listing ? { code: t.listing.internalCode, title: t.listing.part.name } : null,
    buyerName: t.buyer.user.name,
    sellerName: t.seller.displayName,
    lastMessageAt: t.lastMessageAt,
    messageCount: t._count.messages,
    openReports: t._count.reports,
    locked: t.lockedAt !== null,
  }));
}

export interface StaffThreadView {
  id: string;
  /** Null for a direct conversation. */
  listing: { code: string; title: string; status: ListingStatus } | null;
  buyerName: string;
  sellerName: string;
  locked: boolean;
  /** The two people, with whether staff have blocked each from messaging. */
  people: { role: "buyer" | "seller"; userId: string | null; name: string; blocked: boolean }[];
  messages: { id: string; body: string; sentAt: Date; from: "buyer" | "seller" | "support" }[];
  reports: { id: string; reportedByRole: SenderRole; reason: string | null; state: "open" | "resolved"; createdAt: Date }[];
}

/** The full log and the reports. Marks nothing as read: staff are not a party to the conversation. */
export async function getThreadForStaff(db: PrismaClient, actor: Actor, threadId: string): Promise<StaffThreadView> {
  assertStaff(actor);
  const t = await db.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      lockedAt: true,
      listing: { select: { internalCode: true, status: true, part: { select: { name: true } } } },
      buyer: { select: { user: { select: { id: true, name: true, messagingBlockedAt: true } } } },
      seller: { select: { displayName: true, user: { select: { id: true, messagingBlockedAt: true } } } },
      messages: { orderBy: [{ sentAt: "asc" }, { id: "asc" }], select: { id: true, body: true, sentAt: true, senderRole: true } },
      reports: { orderBy: { createdAt: "asc" }, select: { id: true, reportedByRole: true, reason: true, state: true, createdAt: true } },
    },
  });
  if (!t) throw new NotFoundError("Conversation not found");
  return {
    id: t.id,
    listing: t.listing ? { code: t.listing.internalCode, title: t.listing.part.name, status: t.listing.status } : null,
    buyerName: t.buyer.user.name,
    sellerName: t.seller.displayName,
    locked: t.lockedAt !== null,
    people: [
      { role: "buyer", userId: t.buyer.user.id, name: t.buyer.user.name, blocked: t.buyer.user.messagingBlockedAt !== null },
      { role: "seller", userId: t.seller.user?.id ?? null, name: t.seller.displayName, blocked: t.seller.user?.messagingBlockedAt != null },
    ],
    messages: t.messages.map((m) => ({
      id: m.id,
      body: m.body,
      sentAt: m.sentAt,
      from: m.senderRole === "staff" ? "support" : m.senderRole,
    })),
    reports: t.reports,
  };
}

/** Post into any thread as IVO Support. Allowed even while the thread is locked. */
export async function postSupportMessage(db: PrismaClient, actor: Actor, threadId: string, body: string): Promise<void> {
  assertStaff(actor);
  const text = checkedBody(body);
  await db.$transaction(async (tx) => {
    const thread = await tx.thread.findUnique({ where: { id: threadId }, select: { id: true } });
    if (!thread) throw new NotFoundError("Conversation not found");
    await appendMessage(tx, threadId, { userId: actor.userId, role: "staff" }, text);
  });
}

async function setLock(db: PrismaClient, actor: Actor, threadId: string, locked: boolean): Promise<void> {
  assertStaff(actor);
  const thread = await db.thread.findUnique({ where: { id: threadId }, select: { id: true } });
  if (!thread) throw new NotFoundError("Conversation not found");
  await db.thread.update({
    where: { id: threadId },
    data: locked ? { lockedAt: new Date(), lockedById: actor.userId } : { lockedAt: null, lockedById: null },
  });
}

/** Close a thread: buyer and seller can no longer write, and both see that IVO closed it. */
export const lockThread = (db: PrismaClient, actor: Actor, threadId: string) => setLock(db, actor, threadId, true);

export const unlockThread = (db: PrismaClient, actor: Actor, threadId: string) => setLock(db, actor, threadId, false);

/** Clear a report from the queue. */
export async function resolveReport(db: PrismaClient, actor: Actor, reportId: string): Promise<void> {
  assertStaff(actor);
  const report = await db.report.findUnique({ where: { id: reportId }, select: { state: true } });
  if (!report) throw new NotFoundError("Report not found");
  if (report.state !== "open") throw new InvariantError("This report is already resolved");
  await db.report.update({
    where: { id: reportId },
    data: { state: "resolved", resolvedAt: new Date(), resolvedById: actor.userId },
  });
}

/** Stop a user from starting or replying to any conversation. Existing ones become read-only for them. */
export async function setMessagingBlocked(db: PrismaClient, actor: Actor, userId: string, blocked: boolean): Promise<void> {
  assertStaff(actor);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("User not found");
  await db.user.update({ where: { id: userId }, data: { messagingBlockedAt: blocked ? new Date() : null } });
}
