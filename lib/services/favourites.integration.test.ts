import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, NotFoundError } from "../dal/errors";
import { saveListing, unsaveListing, listSavedParts, isListingSaved } from "./favourites";

const TAG = `fav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let sellerId: string;
let donorId: string;
let categoryId: string;
let buyer: Actor;
const listingIds: string[] = [];
const partIds: string[] = [];
const userIds: string[] = [];

type Status = "published" | "reserved" | "draft" | "sold" | "cancelled" | "archived";

async function listing(status: Status = "published") {
  const part = await db.part.create({
    data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`part-${partIds.length}`) },
  });
  partIds.push(part.id);
  const l = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: part.id,
      donorVehicleId: donorId,
      sellerId,
      priceEur: "100.00",
      condition: "used_good",
      status,
      publishedAt: status === "draft" ? null : new Date(),
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(l.id);
  return l;
}

async function buyerActor(label: string): Promise<Actor> {
  const user = await db.user.create({
    data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "buyer" },
  });
  userIds.push(user.id);
  const b = await db.buyer.create({ data: { userId: user.id } });
  return { userId: user.id, role: "buyer", buyerId: b.id, sellerId: null, messagingBlocked: false };
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  const gen = await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } });
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 970 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
  sellerId = (await db.seller.create({ data: { displayName: S("Seller"), contactName: "S", contactEmail: `${TAG}@x.test`, locationCity: "Sofia" } })).id;
  donorId = (await db.donorVehicle.create({ data: { sellerId, generationId: gen.id, label: S("donor") } })).id;
  buyer = await buyerActor("buyer");
});

afterAll(async () => {
  await db.favorite.deleteMany({ where: { listingId: { in: listingIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: donorId } });
  await db.seller.deleteMany({ where: { id: sellerId } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.buyer.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("saving a listing", () => {
  it("puts a published listing in the buyer's saved parts", async () => {
    const l = await listing("published");

    await saveListing(db, buyer, l.internalCode);

    const saved = await listSavedParts(db, buyer);
    expect(saved.map((s) => s.code)).toEqual([l.internalCode]);
  });

  it("is idempotent: saving the same listing twice keeps one saved part", async () => {
    const other = await buyerActor("twice");
    const l = await listing("published");

    await saveListing(db, other, l.internalCode);
    await saveListing(db, other, l.internalCode);

    const saved = await listSavedParts(db, other);
    expect(saved.map((s) => s.code)).toEqual([l.internalCode]);
  });

  it("refuses seller and staff accounts", async () => {
    const l = await listing("published");
    const seller: Actor = { userId: "u-seller", role: "seller", buyerId: null, sellerId, messagingBlocked: false };
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

    await expect(saveListing(db, seller, l.internalCode)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveListing(db, staff, l.internalCode)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.favorite.count({ where: { listingId: l.id } })).toBe(0);
  });

  it("can save a reserved listing (still buyer-visible)", async () => {
    const other = await buyerActor("reserved");
    const l = await listing("reserved");

    await saveListing(db, other, l.internalCode);

    expect((await listSavedParts(db, other)).map((s) => s.code)).toEqual([l.internalCode]);
  });

  it.each(["draft", "sold", "cancelled", "archived"] as const)(
    "cannot save a %s listing (not buyer-visible)",
    async (status) => {
      const l = await listing(status);
      await expect(saveListing(db, buyer, l.internalCode)).rejects.toBeInstanceOf(NotFoundError);
    },
  );

  it("cannot save a listing code that does not exist", async () => {
    await expect(saveListing(db, buyer, S("LST-missing"))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listing saved parts", () => {
  it("returns the most recently saved first", async () => {
    const me = await buyerActor("order");
    const older = await listing("published");
    const newer = await listing("published");
    await db.favorite.create({ data: { buyerId: me.buyerId!, listingId: older.id, createdAt: new Date("2026-01-01") } });
    await db.favorite.create({ data: { buyerId: me.buyerId!, listingId: newer.id, createdAt: new Date("2026-02-01") } });

    const saved = await listSavedParts(db, me);

    expect(saved.map((s) => s.code)).toEqual([newer.internalCode, older.internalCode]);
  });

  it("keeps a saved part after it is sold, reading through to the retained listing", async () => {
    const me = await buyerActor("through");
    const l = await listing("published");
    const part = await db.part.findUniqueOrThrow({ where: { id: l.partId } });
    await saveListing(db, me, l.internalCode);
    await db.listing.update({ where: { id: l.id }, data: { status: "sold" } });

    const [saved] = await listSavedParts(db, me);

    expect(saved).toMatchObject({
      code: l.internalCode,
      title: part.name,
      priceEur: "100", // formatted like the listing page and Browse: String(Decimal)
      photoUrl: "https://x/p.jpg",
      availability: "sold",
      similarHref: `/browse?make=${S("mk")}&model=${S("model")}&generation=${S("gen")}&category=${S("cat")}`,
    });
  });

  it.each([
    ["reserved", "reserved"],
    ["cancelled", "unavailable"],
    ["archived", "unavailable"],
  ] as const)("keeps a saved part when the listing becomes %s, badged %s", async (status, availability) => {
    const me = await buyerActor(`badge-${status}`);
    const l = await listing("published");
    await saveListing(db, me, l.internalCode);
    await db.listing.update({ where: { id: l.id }, data: { status } });

    const saved = await listSavedParts(db, me);

    expect(saved.map((s) => [s.code, s.availability])).toEqual([[l.internalCode, availability]]);
  });

  it("shows a buyer only their own saved parts", async () => {
    const a = await buyerActor("iso-a");
    const b = await buyerActor("iso-b");
    const l = await listing("published");
    await saveListing(db, a, l.internalCode);

    expect(await listSavedParts(db, b)).toEqual([]);
  });

  it("refuses seller and staff accounts", async () => {
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
    await expect(listSavedParts(db, staff)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("isListingSaved — drives the Save / Saved button", () => {
  it("is true only for the buyer who saved it, and false after unsaving", async () => {
    const me = await buyerActor("issaved-me");
    const other = await buyerActor("issaved-other");
    const l = await listing("published");

    expect(await isListingSaved(db, me, l.internalCode)).toBe(false);
    await saveListing(db, me, l.internalCode);
    expect(await isListingSaved(db, me, l.internalCode)).toBe(true);
    expect(await isListingSaved(db, other, l.internalCode)).toBe(false);
    await unsaveListing(db, me, l.internalCode);
    expect(await isListingSaved(db, me, l.internalCode)).toBe(false);
  });

  it("is false for seller and staff accounts and for anonymous callers", async () => {
    const l = await listing("published");
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
    expect(await isListingSaved(db, staff, l.internalCode)).toBe(false);
    expect(await isListingSaved(db, null, l.internalCode)).toBe(false);
  });
});

describe("unsaving a listing", () => {
  it("removes it from the buyer's saved parts, and doing it again is harmless", async () => {
    const me = await buyerActor("unsave");
    const l = await listing("published");
    await saveListing(db, me, l.internalCode);

    await unsaveListing(db, me, l.internalCode);
    await unsaveListing(db, me, l.internalCode);

    expect(await listSavedParts(db, me)).toEqual([]);
  });

  it("only removes the caller's own saved part, never another buyer's", async () => {
    const mine = await buyerActor("mine");
    const theirs = await buyerActor("theirs");
    const l = await listing("published");
    await saveListing(db, mine, l.internalCode);
    await saveListing(db, theirs, l.internalCode);

    await unsaveListing(db, mine, l.internalCode);

    expect(await listSavedParts(db, mine)).toEqual([]);
    expect((await listSavedParts(db, theirs)).map((s) => s.code)).toEqual([l.internalCode]);
  });

  it("can remove a saved part whose listing has since been sold", async () => {
    const me = await buyerActor("sold-unsave");
    const l = await listing("published");
    await saveListing(db, me, l.internalCode);
    await db.listing.update({ where: { id: l.id }, data: { status: "sold" } });

    await unsaveListing(db, me, l.internalCode);

    expect(await listSavedParts(db, me)).toEqual([]);
  });

  it("refuses seller and staff accounts", async () => {
    const l = await listing("published");
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
    await expect(unsaveListing(db, staff, l.internalCode)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
