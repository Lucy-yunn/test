import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { NotFoundError } from "../dal/errors";
import { isSellerAvailable } from "../dal/invariants";
import { getSellerProfile, getDonorVehiclePage } from "./seller-profile";
import { saveSeller, listSavedSellers } from "./saved-sellers";
import { getListingDetail } from "./listing-detail";
import { getPublishChecklist, publishListing } from "./listings";
import { adjustCredits } from "./credits";
import { countQueries } from "./query-counter";

/**
 * Two things every part of the platform has to agree on and stay cheap at:
 *
 *  1. Whether a seller is *available* (has a linked login that is not disabled). Five
 *     modules ask this question. They must all give the same answer for every login state.
 *  2. How many SQL statements the hot paths send, since each one is a network round trip
 *     to the database. Saved sellers must not send more statements as more are saved.
 */
const TAG = `sr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let generationId: string;
let categoryId: string;
const sellerIds: string[] = [];
const userIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

type LoginState = "none" | "banned" | "active";

async function mkSeller(name: string, login: LoginState) {
  let userId: string | null = null;
  if (login !== "none") {
    const user = await db.user.create({
      data: { name: S(name), email: `${name}-${TAG}@example.test`, role: "seller", banned: login === "banned" },
    });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: { displayName: S(name), contactName: "C", contactEmail: `${name}-${TAG}@x.test`, contactPhone: "+359 88 000 0000", locationCity: "Sofia", userId },
  });
  sellerIds.push(seller.id);
  return seller.id;
}

async function mkListing(sellerId: string, status: "published" | "draft" = "published") {
  const donor = await db.donorVehicle.create({ data: { sellerId, generationId, label: S(`car-${donorIds.length}`) } });
  donorIds.push(donor.id);
  const part = await db.part.create({ data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`p-${partIds.length}`) } });
  partIds.push(part.id);
  const listing = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: part.id,
      donorVehicleId: donor.id,
      sellerId,
      priceEur: "10.00",
      condition: "used_good",
      status,
      publishedAt: status === "published" ? new Date() : null,
      noVisiblePartNumber: true,
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(listing.id);
  return { donorId: donor.id, listing };
}

async function mkBuyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const buyer = await db.buyer.create({ data: { userId: user.id } });
  return { userId: user.id, role: "buyer", buyerId: buyer.id, sellerId: null, messagingBlocked: false };
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 920 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
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

describe("one rule for whether a seller is available", () => {
  it.each<[LoginState, boolean]>([
    ["none", false],
    ["banned", false],
    ["active", true],
  ])("a seller whose login is %s: every part of the platform answers available = %s", async (login, expected) => {
    const buyer = await mkBuyer(`buyer-${login}`);
    const sellerId = await mkSeller(`seller-${login}`, login);
    const { donorId, listing } = await mkListing(sellerId, "published");
    const draft = await mkListing(sellerId, "draft");

    // 1. the shared check
    expect(await isSellerAvailable(db, sellerId)).toBe(expected);

    // 2. the public profile and the donor-vehicle page exist only for an available seller
    expect((await getSellerProfile(db, sellerId, buyer)) !== null).toBe(expected);
    expect((await getDonorVehiclePage(db, donorId)) !== null).toBe(expected);

    // 3. a seller can be saved only while available
    if (expected) await expect(saveSeller(db, buyer, sellerId)).resolves.toBeUndefined();
    else await expect(saveSeller(db, buyer, sellerId)).rejects.toBeInstanceOf(NotFoundError);

    // 4. a saved seller who is no longer available stays listed, marked unavailable
    await db.savedSeller.upsert({
      where: { buyerId_sellerId: { buyerId: buyer.buyerId!, sellerId } },
      create: { buyerId: buyer.buyerId!, sellerId },
      update: {},
    });
    const card = (await listSavedSellers(db, buyer)).find((c) => c.sellerId === sellerId);
    expect(card?.available).toBe(expected);

    // 5. the listing page: the seller link is shown only for an available seller
    const detail = await getListingDetail(db, listing.internalCode, buyer);
    expect(detail?.seller.available).toBe(expected);

    // 6. the publish checklist reports it for a draft
    const failures = (await getPublishChecklist(db, draft.listing.id)).failures;
    expect(failures.includes("The seller has an active login")).toBe(!expected);
  });
});

describe("hot paths send few SQL statements, and do not grow with the data", () => {
  it("listing a buyer's saved sellers costs the same for 1 saved seller as for 5", async () => {
    const buyer = await mkBuyer("many");
    const first = await mkSeller("many-0", "active");
    await mkListing(first);
    await db.savedSeller.create({ data: { buyerId: buyer.buyerId!, sellerId: first } });
    const one = await countQueries((c) => listSavedSellers(c, buyer));

    for (let i = 1; i < 5; i++) {
      const id = await mkSeller(`many-${i}`, "active");
      await mkListing(id);
      await db.savedSeller.create({ data: { buyerId: buyer.buyerId!, sellerId: id } });
    }
    const five = await countQueries((c) => listSavedSellers(c, buyer));

    expect(five.result).toHaveLength(5);
    expect(five.statements).toBe(one.statements);
  });

  it("publishing evaluates the checklist once: it costs the checklist plus the write, not a second load", async () => {
    const id = await mkSeller("publish-cost", "active");
    const { listing } = await mkListing(id, "draft");
    await adjustCredits(db, { sellerId: id, amount: 1, note: "test credit", createdBy: null });

    const checklist = await countQueries((c) => getPublishChecklist(c, listing.id));
    expect(checklist.result.ok).toBe(true);

    const publish = await countQueries((c) => publishListing(c, listing.id));
    expect((await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe("published");
    // one evaluation of the checklist, plus the transaction: BEGIN, the status update, the
    // balance update, the ledger row, the "out of credits" notification (this seller spends its
    // last credit) and COMMIT. A second load of the listing would go over.
    expect(publish.statements).toBeLessThanOrEqual(checklist.statements + 6);
  });
});
