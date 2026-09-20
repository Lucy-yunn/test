import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, InvariantError, NotFoundError } from "../dal/errors";
import {
  MAX_MESSAGE_LENGTH,
  startThread,
  findThreadForListing,
  findThreadForOrder,
  startThreadWithOrderBuyer,
  sendMessage,
  listThreads,
  getThread,
  getUnreadCount,
  reportThread,
  listMessageableListings,
  listThreadsForStaff,
  getThreadForStaff,
  postSupportMessage,
  lockThread,
  unlockThread,
  resolveReport,
  setMessagingBlocked,
  moveToTrash,
  restoreFromTrash,
  startDirectThread,
  findDirectThread,
} from "./messaging";

/**
 * In-app messaging (docs/messaging-model.md, ADR-0006): who can start and write to a thread,
 * unread state, and the staff moderation levers. Real local Postgres.
 */
const TAG = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let generationId: string;
let categoryId: string;
const userIds: string[] = [];
const sellerIds: string[] = [];
const buyerIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

/** Builds an Actor from the database, the way getActor does for a real request. */
async function actorOf(userId: string): Promise<Actor> {
  const row = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, messagingBlockedAt: true, buyer: { select: { id: true } }, seller: { select: { id: true } } },
  });
  return {
    userId,
    role: row.role,
    buyerId: row.buyer?.id ?? null,
    sellerId: row.seller?.id ?? null,
    messagingBlocked: row.messagingBlockedAt !== null,
  };
}

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Buyer ${label}`), email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  buyerIds.push(buyer.id);
  return actorOf(user.id);
}

async function mkStaff(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(`Staff ${label}`), email: `${label}-${TAG}@example.test`, role: "staff" } });
  userIds.push(user.id);
  return actorOf(user.id);
}

type Login = "active" | "banned" | "none";
async function mkSeller(label: string, login: Login = "active") {
  let userId: string | null = null;
  if (login !== "none") {
    const user = await db.user.create({
      data: { name: S(`SellerUser ${label}`), email: `${label}-${TAG}@example.test`, role: "seller", banned: login === "banned" },
    });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: {
      displayName: S(`Seller ${label}`),
      contactName: "C",
      contactEmail: `SECRET-EMAIL-${label}-${TAG}@x.test`,
      contactPhone: "+359 SECRET-PHONE",
      locationLine1: "SECRET-STREET 1",
      locationCity: "Plovdiv",
      userId,
    },
  });
  sellerIds.push(seller.id);
  return { sellerId: seller.id, actor: userId ? await actorOf(userId) : null, userId };
}

async function mkListing(sellerId: string, status: "published" | "draft" | "reserved" | "sold" | "archived" = "published") {
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
      priceEur: "55.00",
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

/** A seller with a login, a published listing and a buyer who has opened a thread on it. */
async function withThread(label: string, first = "Is it still available?") {
  const seller = await mkSeller(`s-${label}`);
  const buyer = await mkBuyer(`b-${label}`);
  const listing = await mkListing(seller.sellerId);
  const { threadId } = await startThread(db, buyer, { listingCode: listing.code, body: first });
  return { seller, sellerActor: seller.actor!, buyer, listing, threadId };
}

const pause = () => new Promise((r) => setTimeout(r, 5));

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 970 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  // Messages and reports cascade. Direct threads have no listing, so they are found by seller.
  await db.thread.deleteMany({ where: { OR: [{ listingId: { in: listingIds } }, { sellerId: { in: sellerIds } }] } });
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

describe("starting a thread", () => {
  it("creates the thread and its first message together, tied to the listing and its seller", async () => {
    const seller = await mkSeller("start-s");
    const buyer = await mkBuyer("start-b");
    const listing = await mkListing(seller.sellerId);

    const { threadId } = await startThread(db, buyer, { listingCode: listing.code, body: "  Hello, is it available?  " });

    const thread = await db.thread.findUniqueOrThrow({ where: { id: threadId }, include: { messages: true } });
    expect(thread).toMatchObject({ listingId: listing.id, buyerId: buyer.buyerId, sellerId: seller.sellerId, lockedAt: null });
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]).toMatchObject({ senderRole: "buyer", senderUserId: buyer.userId, body: "Hello, is it available?", readAt: null });
    expect(thread.lastMessageAt).toEqual(thread.messages[0].sentAt);
    expect(await findThreadForListing(db, buyer, listing.code)).toBe(threadId);
  });

  it("re-opens the same thread instead of creating a second one", async () => {
    const t = await withThread("reuse");
    const again = await startThread(db, t.buyer, { listingCode: t.listing.code, body: "One more question" });

    expect(again.threadId).toBe(t.threadId);
    expect(await db.thread.count({ where: { listingId: t.listing.id, buyerId: t.buyer.buyerId! } })).toBe(1);
    expect(await db.message.count({ where: { threadId: t.threadId } })).toBe(2);
  });

  it("gives each buyer, and each listing, its own thread", async () => {
    const seller = await mkSeller("own-s");
    const a = await mkBuyer("own-a");
    const b = await mkBuyer("own-b");
    const one = await mkListing(seller.sellerId);
    const two = await mkListing(seller.sellerId);

    const ids = new Set([
      (await startThread(db, a, { listingCode: one.code, body: "hi" })).threadId,
      (await startThread(db, b, { listingCode: one.code, body: "hi" })).threadId,
      (await startThread(db, a, { listingCode: two.code, body: "hi" })).threadId,
    ]);
    expect(ids.size).toBe(3);
  });

  it("two starts at the same moment still make one thread with both messages", async () => {
    const seller = await mkSeller("race-s");
    const buyer = await mkBuyer("race-b");
    const listing = await mkListing(seller.sellerId);

    const [x, y] = await Promise.all([
      startThread(db, buyer, { listingCode: listing.code, body: "first" }),
      startThread(db, buyer, { listingCode: listing.code, body: "second" }),
    ]);

    expect(x.threadId).toBe(y.threadId);
    expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(1);
    expect(await db.message.count({ where: { threadId: x.threadId } })).toBe(2);
  });

  it("is for buyer accounts only", async () => {
    const seller = await mkSeller("role-s");
    const listing = await mkListing(seller.sellerId);
    for (const actor of [seller.actor!, await mkStaff("role-staff")]) {
      await expect(startThread(db, actor, { listingCode: listing.code, body: "hi" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("works while the listing is published or reserved, and not otherwise", async () => {
    const seller = await mkSeller("status-s");
    const buyer = await mkBuyer("status-b");
    for (const status of ["published", "reserved"] as const) {
      const listing = await mkListing(seller.sellerId, status);
      await expect(startThread(db, buyer, { listingCode: listing.code, body: "hi" })).resolves.toBeDefined();
    }
    for (const status of ["draft", "sold", "archived"] as const) {
      const listing = await mkListing(seller.sellerId, status);
      await expect(startThread(db, buyer, { listingCode: listing.code, body: "hi" })).rejects.toBeInstanceOf(InvariantError);
      expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(0);
    }
  });

  it.each<Login>(["none", "banned"])("is refused when the seller's login is %s", async (login) => {
    const seller = await mkSeller(`nologin-${login}`, login);
    const buyer = await mkBuyer(`nologin-b-${login}`);
    const listing = await mkListing(seller.sellerId);
    await expect(startThread(db, buyer, { listingCode: listing.code, body: "hi" })).rejects.toThrow(/isn.t available for this seller/i);
    expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("is refused for a buyer whom staff have blocked from messaging", async () => {
    const seller = await mkSeller("blocked-s");
    const buyer = await mkBuyer("blocked-b");
    const listing = await mkListing(seller.sellerId);
    await setMessagingBlocked(db, await mkStaff("blocked-staff"), buyer.userId, true);

    await expect(startThread(db, await actorOf(buyer.userId), { listingCode: listing.code, body: "hi" })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(0);
  });

  it("needs a message that is not blank and not longer than the limit, and stores nothing otherwise", async () => {
    const seller = await mkSeller("body-s");
    const buyer = await mkBuyer("body-b");
    const listing = await mkListing(seller.sellerId);
    for (const body of ["", "   ", "\n\t", "x".repeat(MAX_MESSAGE_LENGTH + 1)]) {
      await expect(startThread(db, buyer, { listingCode: listing.code, body })).rejects.toBeInstanceOf(InvariantError);
    }
    expect(await db.thread.count({ where: { listingId: listing.id } })).toBe(0);

    await expect(startThread(db, buyer, { listingCode: listing.code, body: "x".repeat(MAX_MESSAGE_LENGTH) })).resolves.toBeDefined();
  });

  it("says so when the listing does not exist", async () => {
    await expect(startThread(db, await mkBuyer("nolisting"), { listingCode: "LST-nope", body: "hi" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("writing in a thread", () => {
  it("lets the buyer and the seller reply, in order, and moves the thread up", async () => {
    const t = await withThread("reply");
    await pause();
    await sendMessage(db, t.sellerActor, t.threadId, "Yes, it is.");
    await pause();
    await sendMessage(db, t.buyer, t.threadId, "Great, thanks.");

    const messages = await db.message.findMany({ where: { threadId: t.threadId }, orderBy: { sentAt: "asc" } });
    expect(messages.map((m) => [m.senderRole, m.body])).toEqual([
      ["buyer", "Is it still available?"],
      ["seller", "Yes, it is."],
      ["buyer", "Great, thanks."],
    ]);
    const thread = await db.thread.findUniqueOrThrow({ where: { id: t.threadId } });
    expect(thread.lastMessageAt).toEqual(messages[2].sentAt);
  });

  it("is only for the two people in the thread", async () => {
    const t = await withThread("party");
    const strangerBuyer = await mkBuyer("party-buyer");
    const strangerSeller = await mkSeller("party-seller");
    for (const actor of [strangerBuyer, strangerSeller.actor!, await mkStaff("party-staff")]) {
      await expect(sendMessage(db, actor, t.threadId, "hello")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.message.count({ where: { threadId: t.threadId } })).toBe(1);
  });

  it("refuses a blank or over-long message", async () => {
    const t = await withThread("reply-body");
    for (const body of ["", "  ", "y".repeat(MAX_MESSAGE_LENGTH + 1)]) {
      await expect(sendMessage(db, t.buyer, t.threadId, body)).rejects.toBeInstanceOf(InvariantError);
    }
    expect(await db.message.count({ where: { threadId: t.threadId } })).toBe(1);
  });

  it("carries on after the listing is sold or archived, because a thread never closes by itself", async () => {
    const t = await withThread("after-sale");
    await db.listing.update({ where: { id: t.listing.id }, data: { status: "sold" } });
    await expect(sendMessage(db, t.sellerActor, t.threadId, "It has been collected")).resolves.toBeUndefined();
    await db.listing.update({ where: { id: t.listing.id }, data: { status: "archived" } });
    await expect(sendMessage(db, t.buyer, t.threadId, "Thanks")).resolves.toBeUndefined();
  });

  it("stops for both sides while staff have locked the thread, and resumes when it is unlocked", async () => {
    const t = await withThread("locked");
    const staff = await mkStaff("locked-staff");
    await lockThread(db, staff, t.threadId);

    for (const actor of [t.buyer, t.sellerActor]) {
      await expect(sendMessage(db, actor, t.threadId, "hi")).rejects.toThrow(/closed by IVO/i);
    }
    await expect(startThread(db, t.buyer, { listingCode: t.listing.code, body: "hi" })).rejects.toThrow(/closed by IVO/i);
    expect(await db.message.count({ where: { threadId: t.threadId } })).toBe(1);

    await unlockThread(db, staff, t.threadId);
    await expect(sendMessage(db, t.buyer, t.threadId, "hi again")).resolves.toBeUndefined();
  });

  it("stops for a blocked user, who can still read, while the other side can still write", async () => {
    const t = await withThread("blocked-user");
    await setMessagingBlocked(db, await mkStaff("blocked-user-staff"), t.buyer.userId, true);
    const blockedBuyer = await actorOf(t.buyer.userId);

    await expect(sendMessage(db, blockedBuyer, t.threadId, "hi")).rejects.toBeInstanceOf(InvariantError);
    const view = await getThread(db, blockedBuyer, t.threadId);
    expect(view?.state).toBe("blocked");
    expect(view?.messages).toHaveLength(1);
    await expect(sendMessage(db, t.sellerActor, t.threadId, "Hello")).resolves.toBeUndefined();
  });
});

describe("reading and unread state", () => {
  it("counts messages from the other side until they are opened, then marks them read", async () => {
    const t = await withThread("unread");
    await sendMessage(db, t.buyer, t.threadId, "Second message");

    expect(await getUnreadCount(db, t.sellerActor)).toBe(2);
    expect(await getUnreadCount(db, t.buyer)).toBe(0); // their own messages never count
    const before = await listThreads(db, t.sellerActor);
    expect(before.find((x) => x.id === t.threadId)?.unread).toBe(2);

    const view = await getThread(db, t.sellerActor, t.threadId);

    expect(view?.messages).toHaveLength(2);
    expect(await getUnreadCount(db, t.sellerActor)).toBe(0);
    const stamped = await db.message.findMany({ where: { threadId: t.threadId } });
    expect(stamped.every((m) => m.readAt instanceof Date)).toBe(true);
  });

  it("does not mark a message read when the buyer, who wrote it, opens the thread", async () => {
    const t = await withThread("own-read");
    await getThread(db, t.buyer, t.threadId);
    expect((await db.message.findFirstOrThrow({ where: { threadId: t.threadId } })).readAt).toBeNull();
  });

  it("does not mark anything read when staff open a thread", async () => {
    const t = await withThread("staff-read");
    await getThreadForStaff(db, await mkStaff("staff-read-s"), t.threadId);
    expect((await db.message.findFirstOrThrow({ where: { threadId: t.threadId } })).readAt).toBeNull();
  });

  it("totals unread messages across threads", async () => {
    const seller = await mkSeller("total-s");
    const b1 = await mkBuyer("total-1");
    const b2 = await mkBuyer("total-2");
    const l1 = await mkListing(seller.sellerId);
    const l2 = await mkListing(seller.sellerId);
    await startThread(db, b1, { listingCode: l1.code, body: "a" });
    await startThread(db, b2, { listingCode: l2.code, body: "b" });
    expect(await getUnreadCount(db, seller.actor!)).toBe(2);
  });

  it("shows a thread only to its two people", async () => {
    const t = await withThread("private");
    expect(await getThread(db, await mkBuyer("private-b"), t.threadId)).toBeNull();
    expect(await getThread(db, (await mkSeller("private-s")).actor!, t.threadId)).toBeNull();
    expect(await getThread(db, await mkStaff("private-staff"), t.threadId)).toBeNull(); // staff use the admin view
    expect(await listThreads(db, await mkBuyer("private-b2"))).toEqual([]);
  });

  it("lists a person's threads, most recently active first, naming the other side", async () => {
    const seller = await mkSeller("list-s");
    const buyer = await mkBuyer("list-b");
    const first = await mkListing(seller.sellerId);
    const second = await mkListing(seller.sellerId);
    const t1 = (await startThread(db, buyer, { listingCode: first.code, body: "about the first" })).threadId;
    await pause();
    const t2 = (await startThread(db, buyer, { listingCode: second.code, body: "about the second" })).threadId;
    await pause();
    await sendMessage(db, seller.actor!, t1, "Reply on the first");

    const buyerList = await listThreads(db, buyer);
    expect(buyerList.map((x) => x.id)).toEqual([t1, t2]);
    expect(buyerList[0]).toMatchObject({
      otherPartyName: S("Seller list-s"),
      lastMessage: { body: "Reply on the first", from: "them" },
      unread: 1,
      locked: false,
      listing: { code: first.code },
    });
    const sellerList = await listThreads(db, seller.actor!);
    expect(sellerList[0].otherPartyName).toBe(S("Buyer list-b"));
  });

  it("pins the listing header, with a badge that follows the listing's status, and keeps it after the listing leaves browse", async () => {
    const t = await withThread("header");
    let view = await getThread(db, t.buyer, t.threadId);
    expect(view?.listing).toMatchObject({ code: t.listing.code, priceEur: "55", status: "published", badge: null, photoUrl: "https://x/p.jpg" });

    await db.listing.update({ where: { id: t.listing.id }, data: { status: "reserved" } });
    await db.order.create({
      data: {
        internalCode: S("ORD-mine"), buyerId: t.buyer.buyerId!, sellerId: t.seller.sellerId, listingId: t.listing.id, itemPriceEur: "55.00",
        recipientName: "A", phone: "1", addressLine1: "a", city: "c", postcode: "p",
      },
    });
    view = await getThread(db, t.buyer, t.threadId);
    expect(view?.listing?.badge).toBe("You've reserved this item");
    expect((await getThread(db, t.sellerActor, t.threadId))?.listing?.badge).toBe("Reserved");

    const other = await mkBuyer("header-other");
    const otherThread = (await startThread(db, other, { listingCode: t.listing.code, body: "still there?" })).threadId;
    expect((await getThread(db, other, otherThread))?.listing?.badge).toBe("Reserved by another buyer");

    await db.order.deleteMany({ where: { listingId: t.listing.id } });
    await db.listing.update({ where: { id: t.listing.id }, data: { status: "sold" } });
    expect((await getThread(db, t.buyer, t.threadId))?.listing?.badge).toBe("Sold");
    await db.listing.update({ where: { id: t.listing.id }, data: { status: "archived" } });
    expect((await getThread(db, t.buyer, t.threadId))?.listing?.badge).toBe("No longer listed");
  });

  it("never gives a buyer the seller's contact details or street address", async () => {
    const t = await withThread("contact");
    const json = JSON.stringify([await getThread(db, t.buyer, t.threadId), await listThreads(db, t.buyer)]);
    for (const secret of ["SECRET-EMAIL", "SECRET-PHONE", "SECRET-STREET"]) expect(json).not.toContain(secret);
  });
});

describe("reporting a thread", () => {
  it("lets either person report it, with an optional reason, once each while it is open", async () => {
    const t = await withThread("report");

    await reportThread(db, t.buyer, t.threadId, "  Asked me to pay elsewhere  ");
    await reportThread(db, t.buyer, t.threadId, "again");
    await reportThread(db, t.sellerActor, t.threadId);

    const reports = await db.report.findMany({ where: { threadId: t.threadId }, orderBy: { createdAt: "asc" } });
    expect(reports.map((r) => [r.reportedByRole, r.reason, r.state])).toEqual([
      ["buyer", "Asked me to pay elsewhere", "open"],
      ["seller", null, "open"],
    ]);
  });

  it("is only for the two people in the thread", async () => {
    const t = await withThread("report-who");
    for (const actor of [await mkBuyer("report-stranger"), await mkStaff("report-staff")]) {
      await expect(reportThread(db, actor, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.report.count({ where: { threadId: t.threadId } })).toBe(0);
  });

  it("does not change the thread: both can keep writing", async () => {
    const t = await withThread("report-open");
    await reportThread(db, t.buyer, t.threadId);
    await expect(sendMessage(db, t.sellerActor, t.threadId, "still here")).resolves.toBeUndefined();
  });
});

describe("what staff can do", () => {
  it("lists every thread newest first and flags the ones with an open report", async () => {
    const quiet = await withThread("staff-quiet");
    await pause();
    const flagged = await withThread("staff-flagged");
    await reportThread(db, flagged.buyer, flagged.threadId, "spam");
    const staff = await mkStaff("staff-list");

    const rows = await listThreadsForStaff(db, staff);

    const idx = (id: string) => rows.findIndex((r) => r.id === id);
    expect(idx(flagged.threadId)).toBeLessThan(idx(quiet.threadId));
    expect(rows[idx(flagged.threadId)]).toMatchObject({ openReports: 1, buyerName: S("Buyer b-staff-flagged"), sellerName: S("Seller s-staff-flagged") });
    expect(rows[idx(quiet.threadId)].openReports).toBe(0);
  });

  it("reads any thread in full, with who wrote each message and the reports", async () => {
    const t = await withThread("staff-open");
    await sendMessage(db, t.sellerActor, t.threadId, "Yes");
    await reportThread(db, t.sellerActor, t.threadId, "rude");

    const view = await getThreadForStaff(db, await mkStaff("staff-open-s"), t.threadId);

    expect(view.messages.map((m) => [m.from, m.body])).toEqual([["buyer", "Is it still available?"], ["seller", "Yes"]]);
    expect(view.reports).toEqual([expect.objectContaining({ reportedByRole: "seller", reason: "rude", state: "open" })]);
    expect(view).toMatchObject({ locked: false, buyerName: S("Buyer b-staff-open"), sellerName: S("Seller s-staff-open") });
    // who can be blocked from messaging, and whether they already are
    expect(view.people).toEqual([
      { role: "buyer", userId: t.buyer.userId, name: S("Buyer b-staff-open"), blocked: false },
      { role: "seller", userId: t.seller.userId, name: S("Seller s-staff-open"), blocked: false },
    ]);
    await setMessagingBlocked(db, await mkStaff("staff-open-block"), t.buyer.userId, true);
    expect((await getThreadForStaff(db, await mkStaff("staff-open-s2"), t.threadId)).people[0].blocked).toBe(true);
  });

  it("posts as IVO Support, which both people see as support and never as the seller, even in a locked thread", async () => {
    const t = await withThread("support");
    const staff = await mkStaff("support-s");
    await lockThread(db, staff, t.threadId);

    await postSupportMessage(db, staff, t.threadId, "  Please keep the chat on the platform.  ");

    const stored = await db.message.findFirstOrThrow({ where: { threadId: t.threadId, senderRole: "staff" } });
    expect(stored).toMatchObject({ senderUserId: staff.userId, body: "Please keep the chat on the platform." });
    for (const actor of [t.buyer, t.sellerActor]) {
      const view = await getThread(db, actor, t.threadId);
      const support = view?.messages.find((m) => m.body.startsWith("Please keep"));
      expect(support?.from).toBe("support");
      expect(view?.state).toBe("locked");
    }
  });

  it("locks and unlocks, records who locked it, and only staff can", async () => {
    const t = await withThread("lockrole");
    const staff = await mkStaff("lockrole-s");
    for (const actor of [t.buyer, t.sellerActor]) {
      await expect(lockThread(db, actor, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(unlockThread(db, actor, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(postSupportMessage(db, actor, t.threadId, "hi")).rejects.toBeInstanceOf(ForbiddenError);
    }

    await lockThread(db, staff, t.threadId);
    expect(await db.thread.findUniqueOrThrow({ where: { id: t.threadId } })).toMatchObject({ lockedById: staff.userId });
    expect((await db.thread.findUniqueOrThrow({ where: { id: t.threadId } })).lockedAt).toBeInstanceOf(Date);

    await unlockThread(db, staff, t.threadId);
    expect(await db.thread.findUniqueOrThrow({ where: { id: t.threadId } })).toMatchObject({ lockedAt: null, lockedById: null });
  });

  it("resolves a report, once, and only staff can", async () => {
    const t = await withThread("resolve");
    await reportThread(db, t.buyer, t.threadId, "spam");
    const report = await db.report.findFirstOrThrow({ where: { threadId: t.threadId } });
    const staff = await mkStaff("resolve-s");

    await expect(resolveReport(db, t.buyer, report.id)).rejects.toBeInstanceOf(ForbiddenError);
    await resolveReport(db, staff, report.id);

    expect(await db.report.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ state: "resolved", resolvedById: staff.userId });
    await expect(resolveReport(db, staff, report.id)).rejects.toBeInstanceOf(InvariantError);
    const rows = await listThreadsForStaff(db, staff);
    expect(rows.find((r) => r.id === t.threadId)?.openReports).toBe(0);
  });

  it("blocks and unblocks a user from messaging, only staff can, and an unknown user is refused", async () => {
    const buyer = await mkBuyer("block-target");
    const staff = await mkStaff("block-staff");
    await expect(setMessagingBlocked(db, buyer, buyer.userId, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setMessagingBlocked(db, staff, "nope", true)).rejects.toBeInstanceOf(NotFoundError);

    await setMessagingBlocked(db, staff, buyer.userId, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: buyer.userId } })).messagingBlockedAt).toBeInstanceOf(Date);
    await setMessagingBlocked(db, staff, buyer.userId, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: buyer.userId } })).messagingBlockedAt).toBeNull();
  });

  it("is staff-only to list threads and open one", async () => {
    const t = await withThread("staff-only");
    for (const actor of [t.buyer, t.sellerActor]) {
      await expect(listThreadsForStaff(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(getThreadForStaff(db, actor, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("the seller profile's 'which part?' picker", () => {
  it("lists the seller's published and reserved listings, newest first, and nothing else", async () => {
    const seller = await mkSeller("picker-s");
    const other = await mkSeller("picker-other");
    const first = await mkListing(seller.sellerId, "published");
    await pause();
    const second = await mkListing(seller.sellerId, "reserved");
    await mkListing(seller.sellerId, "draft");
    await mkListing(seller.sellerId, "sold");
    await mkListing(other.sellerId, "published");

    const rows = await listMessageableListings(db, seller.sellerId);

    expect(rows.map((r) => r.code)).toEqual([second.code, first.code]);
    expect(rows[0]).toMatchObject({ priceEur: "55", photoUrl: "https://x/p.jpg" });
    expect(rows[0].title).toMatch(/part-/);
  });
});

describe("a seller writing first to the buyer of their own order (docs/seller-center.md section 3.3)", () => {
  async function withOrder(label: string, listingStatus: "published" | "reserved" | "sold" = "reserved") {
    const seller = await mkSeller(`o-s-${label}`);
    const buyer = await mkBuyer(`o-b-${label}`);
    const listing = await mkListing(seller.sellerId, listingStatus);
    const order = await db.order.create({
      data: {
        internalCode: S(`ORD-${label}`), buyerId: buyer.buyerId!, sellerId: seller.sellerId, listingId: listing.id, itemPriceEur: "55.00",
        recipientName: "R", phone: "1", addressLine1: "a", city: "c", postcode: "p",
      },
    });
    return { seller, sellerActor: seller.actor!, buyer, listing, orderId: order.id };
  }

  it("creates the thread for that listing and buyer, with the seller's message first", async () => {
    const t = await withOrder("start");
    expect(await findThreadForOrder(db, t.sellerActor, t.orderId)).toBeNull();

    const { threadId } = await startThreadWithOrderBuyer(db, t.sellerActor, { orderId: t.orderId, body: "  Please confirm your address  " });

    const thread = await db.thread.findUniqueOrThrow({ where: { id: threadId }, include: { messages: true } });
    expect(thread).toMatchObject({ listingId: t.listing.id, buyerId: t.buyer.buyerId, sellerId: t.seller.sellerId });
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0]).toMatchObject({ senderRole: "seller", senderUserId: t.sellerActor.userId, body: "Please confirm your address" });
    expect(await findThreadForOrder(db, t.sellerActor, t.orderId)).toBe(threadId);
    expect((await getThread(db, t.buyer, threadId))?.messages.map((m) => m.from)).toEqual(["them"]);
  });

  it("uses the thread the buyer already opened, and works whatever the listing's status", async () => {
    const t = await withOrder("reuse", "sold");
    // The buyer opened this thread while the listing was still on sale.
    const threadId = (
      await db.thread.create({
        data: {
          listingId: t.listing.id,
          buyerId: t.buyer.buyerId!,
          sellerId: t.seller.sellerId,
          messages: { create: { senderRole: "buyer", senderUserId: t.buyer.userId, body: "hello" } },
        },
      })
    ).id;

    const again = await startThreadWithOrderBuyer(db, t.sellerActor, { orderId: t.orderId, body: "Your part is ready" });

    expect(again.threadId).toBe(threadId);
    expect(await db.message.count({ where: { threadId } })).toBe(2);
    expect(await db.thread.count({ where: { listingId: t.listing.id, buyerId: t.buyer.buyerId! } })).toBe(1);
  });

  it("is only for the seller the order belongs to, never a buyer, another seller or staff", async () => {
    const t = await withOrder("who");
    const other = await mkSeller("o-other");
    for (const actor of [t.buyer, other.actor!, await mkStaff("o-staff")]) {
      await expect(startThreadWithOrderBuyer(db, actor, { orderId: t.orderId, body: "hi" })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await findThreadForOrder(db, actor, t.orderId)).toBeNull();
    }
    expect(await db.thread.count({ where: { listingId: t.listing.id } })).toBe(0);
    await expect(startThreadWithOrderBuyer(db, t.sellerActor, { orderId: "nope", body: "hi" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("needs a message, and stops while the thread is locked or the seller is blocked", async () => {
    const t = await withOrder("rules");
    await expect(startThreadWithOrderBuyer(db, t.sellerActor, { orderId: t.orderId, body: "   " })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.thread.count({ where: { listingId: t.listing.id } })).toBe(0);

    const { threadId } = await startThreadWithOrderBuyer(db, t.sellerActor, { orderId: t.orderId, body: "hello" });
    const staff = await mkStaff("o-rules-staff");
    await lockThread(db, staff, threadId);
    await expect(startThreadWithOrderBuyer(db, t.sellerActor, { orderId: t.orderId, body: "again" })).rejects.toThrow(/closed by IVO/i);
    await unlockThread(db, staff, threadId);

    await setMessagingBlocked(db, staff, t.sellerActor.userId, true);
    await expect(startThreadWithOrderBuyer(db, await actorOf(t.sellerActor.userId), { orderId: t.orderId, body: "again" })).rejects.toBeInstanceOf(InvariantError);
  });
});

// ---------------------------------------------------------------------------
// The inbox: who owes a reply, and the trash (each side has its own)
// ---------------------------------------------------------------------------

const itemFor = async (actor: Actor, threadId: string) => (await listThreads(db, actor)).find((x) => x.id === threadId)!;

describe("who owes a reply", () => {
  it("is the seller after the buyer writes, the buyer after the seller replies, and support messages change nothing", async () => {
    const t = await withThread("needs-reply");
    expect((await itemFor(t.sellerActor, t.threadId)).needsReply).toBe(true);
    expect((await itemFor(t.buyer, t.threadId)).needsReply).toBe(false);

    await pause();
    await sendMessage(db, t.sellerActor, t.threadId, "Yes it is");
    expect((await itemFor(t.sellerActor, t.threadId)).needsReply).toBe(false);
    expect((await itemFor(t.buyer, t.threadId)).needsReply).toBe(true);

    await pause();
    const staff = await mkStaff("needs-reply-staff");
    await postSupportMessage(db, staff, t.threadId, "Hello from support");
    expect((await itemFor(t.sellerActor, t.threadId)).needsReply).toBe(false);
    expect((await itemFor(t.buyer, t.threadId)).needsReply).toBe(true);
  });
});

describe("moving a conversation to the trash", () => {
  it("is each person's own: the other side still sees it in the inbox", async () => {
    const t = await withThread("trash-own");
    await moveToTrash(db, t.sellerActor, t.threadId);

    expect((await itemFor(t.sellerActor, t.threadId)).trashed).toBe(true);
    expect((await itemFor(t.buyer, t.threadId)).trashed).toBe(false);

    await moveToTrash(db, t.buyer, t.threadId);
    expect((await itemFor(t.buyer, t.threadId)).trashed).toBe(true);
  });

  it("marks what was waiting as read, so the unread badge does not keep counting it", async () => {
    const t = await withThread("trash-read");
    expect(await getUnreadCount(db, t.sellerActor)).toBe(1);
    await moveToTrash(db, t.sellerActor, t.threadId);
    expect(await getUnreadCount(db, t.sellerActor)).toBe(0);
  });

  it("brings it back to the inbox when the other side writes again", async () => {
    const t = await withThread("trash-back");
    await moveToTrash(db, t.sellerActor, t.threadId);
    await pause();
    await sendMessage(db, t.buyer, t.threadId, "Hello? Still there?");

    const item = await itemFor(t.sellerActor, t.threadId);
    expect(item.trashed).toBe(false);
    expect(item.needsReply).toBe(true);
    expect(item.unread).toBe(1);
  });

  it("brings it back for the buyer too, when the seller writes again", async () => {
    const t = await withThread("trash-back-buyer");
    await moveToTrash(db, t.buyer, t.threadId);
    await pause();
    await sendMessage(db, t.sellerActor, t.threadId, "Sorry for the delay");
    expect((await itemFor(t.buyer, t.threadId)).trashed).toBe(false);
  });

  it("comes out of the trash for the person who writes in it", async () => {
    const t = await withThread("trash-own-write");
    await moveToTrash(db, t.sellerActor, t.threadId);
    await sendMessage(db, t.sellerActor, t.threadId, "Actually, yes");
    expect((await itemFor(t.sellerActor, t.threadId)).trashed).toBe(false);
  });

  it("is undone by restoring, and a support message brings it back for both people", async () => {
    const t = await withThread("trash-restore");
    await moveToTrash(db, t.sellerActor, t.threadId);
    await restoreFromTrash(db, t.sellerActor, t.threadId);
    expect((await itemFor(t.sellerActor, t.threadId)).trashed).toBe(false);

    await moveToTrash(db, t.sellerActor, t.threadId);
    await moveToTrash(db, t.buyer, t.threadId);
    await pause();
    await postSupportMessage(db, await mkStaff("trash-restore-staff"), t.threadId, "IVO here");
    expect((await itemFor(t.sellerActor, t.threadId)).trashed).toBe(false);
    expect((await itemFor(t.buyer, t.threadId)).trashed).toBe(false);
  });

  it("is only for the two people in the thread", async () => {
    const t = await withThread("trash-party");
    const stranger = await mkBuyer("trash-party-stranger");
    const staff = await mkStaff("trash-party-staff");
    await expect(moveToTrash(db, stranger, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(moveToTrash(db, staff, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(restoreFromTrash(db, stranger, t.threadId)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(moveToTrash(db, t.buyer, "nope")).rejects.toBeInstanceOf(NotFoundError);
    expect((await itemFor(t.sellerActor, t.threadId)).trashed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A direct conversation: a buyer and a seller, about no listing in particular
// ---------------------------------------------------------------------------

describe("a direct conversation with a seller", () => {
  it("creates a thread with no listing and the buyer's first message together", async () => {
    const seller = await mkSeller("direct-s");
    const buyer = await mkBuyer("direct-b");
    const { threadId } = await startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "Do you ship to Varna?" });

    const thread = await db.thread.findUniqueOrThrow({ where: { id: threadId }, include: { messages: true } });
    expect(thread).toMatchObject({ listingId: null, buyerId: buyer.buyerId, sellerId: seller.sellerId });
    expect(thread.messages.map((m) => [m.senderRole, m.body])).toEqual([["buyer", "Do you ship to Varna?"]]);
  });

  it("is one thread per buyer and seller: writing again, even at the same moment, goes into it", async () => {
    const seller = await mkSeller("direct-one-s");
    const buyer = await mkBuyer("direct-one-b");
    const [x, y] = await Promise.all([
      startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "first" }),
      startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "second" }),
    ]);
    const z = await startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "third" });

    expect(new Set([x.threadId, y.threadId, z.threadId]).size).toBe(1);
    expect(await db.thread.count({ where: { sellerId: seller.sellerId, buyerId: buyer.buyerId!, listingId: null } })).toBe(1);
    expect(await db.message.count({ where: { threadId: x.threadId } })).toBe(3);
    expect(await findDirectThread(db, buyer, seller.sellerId)).toBe(x.threadId);
  });

  it("is separate from the buyer's threads about that seller's listings, and from other buyers and sellers", async () => {
    const seller = await mkSeller("direct-sep-s");
    const other = await mkSeller("direct-sep-o");
    const buyer = await mkBuyer("direct-sep-b");
    const buyer2 = await mkBuyer("direct-sep-b2");
    const listing = await mkListing(seller.sellerId);
    const about = (await startThread(db, buyer, { listingCode: listing.code, body: "about the part" })).threadId;

    const direct = (await startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "in general" })).threadId;
    const otherSeller = (await startDirectThread(db, buyer, { sellerId: other.sellerId, body: "hi" })).threadId;
    const otherBuyer = (await startDirectThread(db, buyer2, { sellerId: seller.sellerId, body: "hi" })).threadId;

    expect(new Set([about, direct, otherSeller, otherBuyer]).size).toBe(4);
    expect(await findDirectThread(db, buyer, seller.sellerId)).toBe(direct);
    expect(await findDirectThread(db, buyer, "nope")).toBeNull();
  });

  it("is for buyers, to a seller who has a login, who are not blocked, with a real message", async () => {
    const seller = await mkSeller("direct-rules-s");
    const noLogin = await mkSeller("direct-rules-n", "none");
    const banned = await mkSeller("direct-rules-x", "banned");
    const buyer = await mkBuyer("direct-rules-b");

    await expect(startDirectThread(db, seller.actor!, { sellerId: seller.sellerId, body: "hi" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(startDirectThread(db, buyer, { sellerId: noLogin.sellerId, body: "hi" })).rejects.toBeInstanceOf(InvariantError);
    await expect(startDirectThread(db, buyer, { sellerId: banned.sellerId, body: "hi" })).rejects.toBeInstanceOf(InvariantError);
    await expect(startDirectThread(db, buyer, { sellerId: "nope", body: "hi" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "   " })).rejects.toBeInstanceOf(InvariantError);

    const staff = await mkStaff("direct-rules-staff");
    await setMessagingBlocked(db, staff, buyer.userId, true);
    await expect(startDirectThread(db, await actorOf(buyer.userId), { sellerId: seller.sellerId, body: "hi" })).rejects.toBeInstanceOf(InvariantError);
    expect(await db.thread.count({ where: { sellerId: { in: [seller.sellerId, noLogin.sellerId, banned.sellerId] } } })).toBe(0);
  });

  it("shows in both people's lists and opens with no listing header, and both can write in it", async () => {
    const seller = await mkSeller("direct-view-s");
    const buyer = await mkBuyer("direct-view-b");
    const { threadId } = await startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "Do you have a gearbox for a Golf?" });

    expect(await itemFor(seller.actor!, threadId)).toMatchObject({
      listing: null,
      otherPartyName: S("Buyer direct-view-b"),
      otherPartyId: buyer.buyerId,
      needsReply: true,
    });
    expect(await itemFor(buyer, threadId)).toMatchObject({
      listing: null,
      otherPartyName: S("Seller direct-view-s"),
      otherPartyId: seller.sellerId,
    });

    expect(await getThread(db, seller.actor!, threadId)).toMatchObject({ listing: null, state: "open" });
    await sendMessage(db, seller.actor!, threadId, "Yes, I do");
    expect((await getThread(db, buyer, threadId))!.messages.map((m) => m.from)).toEqual(["me", "them"]);
  });

  it("is visible to staff, who see that it is about no listing", async () => {
    const seller = await mkSeller("direct-staff-s");
    const buyer = await mkBuyer("direct-staff-b");
    const { threadId } = await startDirectThread(db, buyer, { sellerId: seller.sellerId, body: "hello" });
    const staff = await mkStaff("direct-staff-staff");

    expect((await listThreadsForStaff(db, staff)).find((x) => x.id === threadId)).toMatchObject({ listing: null });
    expect(await getThreadForStaff(db, staff, threadId)).toMatchObject({ listing: null, buyerName: S("Buyer direct-staff-b") });
  });
});
