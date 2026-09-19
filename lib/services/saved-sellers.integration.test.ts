import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, NotFoundError } from "../dal/errors";
import { saveSeller, unsaveSeller, isSellerSaved, listSavedSellers } from "./saved-sellers";

const TAG = `ss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let generationId: string;
let categoryId: string;
const sellerIds: string[] = [];
const userIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

type Status = "published" | "reserved" | "draft" | "sold";

/** A seller with a login, an optional avatar, and one listing per status given. */
async function mkSeller(name: string, statuses: Status[] = ["published"], opts: { login?: boolean; avatarUrl?: string; lastActiveAt?: Date } = {}) {
  let userId: string | null = null;
  if (opts.login !== false) {
    const user = await db.user.create({ data: { name: S(name), email: `seller-${name}-${TAG}@example.test`, role: "seller" } });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: {
      displayName: S(name),
      contactName: "C",
      contactEmail: `${name}-${TAG}@x.test`,
      locationCity: "Varna",
      avatarUrl: opts.avatarUrl ?? null,
      lastActiveAt: opts.lastActiveAt ?? null,
      userId,
    },
  });
  sellerIds.push(seller.id);
  if (statuses.length) {
    const donor = await db.donorVehicle.create({ data: { sellerId: seller.id, generationId, label: S(`car-${donorIds.length}`) } });
    donorIds.push(donor.id);
    for (const status of statuses) {
      const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`p-${partIds.length}`) } });
      partIds.push(part.id);
      const l = await db.listing.create({
        data: {
          internalCode: S(`LST-${listingIds.length}`),
          partId: part.id,
          donorVehicleId: donor.id,
          sellerId: seller.id,
          priceEur: "10.00",
          condition: "used_good",
          status,
          publishedAt: status === "draft" ? null : new Date(),
        },
      });
      listingIds.push(l.id);
    }
  }
  return seller.id;
}

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const b = await db.buyer.create({ data: { userId: user.id } });
  return { userId: user.id, role: "buyer", buyerId: b.id, sellerId: null, messagingBlocked: false };
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 930 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  await db.savedSeller.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.buyer.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

describe("saving a seller", () => {
  it("puts the seller in the buyer's saved sellers, with what the card shows", async () => {
    const buyer = await mkBuyer("card");
    const lastActive = new Date("2026-09-10T08:00:00Z");
    const id = await mkSeller("card", ["published", "reserved", "sold", "draft"], { avatarUrl: "https://x/a.jpg", lastActiveAt: lastActive });

    await saveSeller(db, buyer, id);

    const [card] = await listSavedSellers(db, buyer);
    expect(card).toMatchObject({
      sellerId: id,
      name: S("card"),
      avatarUrl: "https://x/a.jpg",
      city: "Varna",
      lastActiveAt: lastActive,
      onShelf: 2, // published + reserved
      available: true,
    });
  });

  it("is idempotent, in both directions", async () => {
    const buyer = await mkBuyer("idem");
    const id = await mkSeller("idem");

    await saveSeller(db, buyer, id);
    await saveSeller(db, buyer, id);
    expect(await listSavedSellers(db, buyer)).toHaveLength(1);

    await unsaveSeller(db, buyer, id);
    await unsaveSeller(db, buyer, id);
    expect(await listSavedSellers(db, buyer)).toEqual([]);
  });

  it("returns the most recently saved first, and shows a buyer only their own", async () => {
    const buyer = await mkBuyer("order");
    const other = await mkBuyer("order-other");
    const a = await mkSeller("order-a");
    const b = await mkSeller("order-b");
    await db.savedSeller.create({ data: { buyerId: buyer.buyerId!, sellerId: a, createdAt: new Date("2026-01-01") } });
    await db.savedSeller.create({ data: { buyerId: buyer.buyerId!, sellerId: b, createdAt: new Date("2026-02-01") } });

    expect((await listSavedSellers(db, buyer)).map((c) => c.sellerId)).toEqual([b, a]);
    expect(await listSavedSellers(db, other)).toEqual([]);
  });

  it("only removes the caller's own saved seller", async () => {
    const mine = await mkBuyer("own-mine");
    const theirs = await mkBuyer("own-theirs");
    const id = await mkSeller("own");
    await saveSeller(db, mine, id);
    await saveSeller(db, theirs, id);

    await unsaveSeller(db, mine, id);

    expect(await listSavedSellers(db, mine)).toEqual([]);
    expect((await listSavedSellers(db, theirs)).map((c) => c.sellerId)).toEqual([id]);
  });

  it("refuses a seller who has no public profile: unknown, no login, or nothing published", async () => {
    const buyer = await mkBuyer("noprofile");
    const noLogin = await mkSeller("no-login", ["published"], { login: false });
    const draftsOnly = await mkSeller("drafts", ["draft"]);

    await expect(saveSeller(db, buyer, "nope")).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveSeller(db, buyer, noLogin)).rejects.toBeInstanceOf(NotFoundError);
    await expect(saveSeller(db, buyer, draftsOnly)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listSavedSellers(db, buyer)).toEqual([]);
  });

  it("keeps a saved seller who later loses their profile, marked unavailable", async () => {
    const buyer = await mkBuyer("later");
    const id = await mkSeller("later");
    await saveSeller(db, buyer, id);
    const seller = await db.seller.findUniqueOrThrow({ where: { id }, select: { userId: true } });
    await db.user.update({ where: { id: seller.userId! }, data: { banned: true } });

    const [card] = await listSavedSellers(db, buyer);

    expect(card).toMatchObject({ sellerId: id, name: S("later"), available: false });
  });
});

describe("isSellerSaved: drives the heart on the seller profile", () => {
  it("is true only for the buyer who saved the seller; anonymous and other roles get false", async () => {
    const me = await mkBuyer("heart-me");
    const other = await mkBuyer("heart-other");
    const id = await mkSeller("heart");
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

    expect(await isSellerSaved(db, me, id)).toBe(false);
    await saveSeller(db, me, id);
    expect(await isSellerSaved(db, me, id)).toBe(true);
    expect(await isSellerSaved(db, other, id)).toBe(false);
    expect(await isSellerSaved(db, staff, id)).toBe(false);
    expect(await isSellerSaved(db, null, id)).toBe(false);
  });
});

describe("saved sellers are for buyer accounts only", () => {
  it("refuses seller and staff accounts on every operation", async () => {
    const id = await mkSeller("roles");
    const seller: Actor = { userId: "u-s", role: "seller", buyerId: null, sellerId: id, messagingBlocked: false };
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

    for (const actor of [seller, staff]) {
      await expect(saveSeller(db, actor, id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(unsaveSeller(db, actor, id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listSavedSellers(db, actor)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});
