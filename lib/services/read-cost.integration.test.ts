import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { getListingDetail, getSiblingListings } from "./listing-detail";
import { getSellerProfile, listSellerCars, getDonorVehiclePage } from "./seller-profile";
import { browseListings } from "./browse";
import { countQueries } from "./query-counter";

/**
 * How many SQL statements each buyer-facing read sends. Every statement is a network
 * round trip, so the pages that read a listing together with its part, car, seller and
 * photos should ask the database once, not once per relation.
 *
 * The count must not depend on how much data there is: the fixture has several listings
 * and photos per car so a per-row query would show up.
 */
const TAG = `rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let sellerId: string;
let userId: string;
let donorId: string;
let listingCode: string;
let categoryId: string;
const listingIds: string[] = [];
const partIds: string[] = [];

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  const gen = await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } });
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 930 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;

  const user = await db.user.create({ data: { name: S("seller"), email: `seller-${TAG}@example.test`, role: "seller" } });
  userId = user.id;
  sellerId = (
    await db.seller.create({
      data: { displayName: S("Seller"), contactName: "C", contactEmail: `s-${TAG}@x.test`, locationCity: "Sofia", userId },
    })
  ).id;
  donorId = (
    await db.donorVehicle.create({
      data: {
        sellerId,
        generationId: gen.id,
        label: S("car"),
        photos: { create: [1, 2, 3].map((n) => ({ url: `https://x/car-${n}.jpg`, displayOrder: n })) },
      },
    })
  ).id;

  for (let i = 0; i < 4; i++) {
    const part = await db.part.create({
      data: {
        internalCode: S(`PRT-${i}`),
        categoryId,
        name: S(`part-${i}`),
        partNumbers: { create: [{ raw: S(`PN-${i}`), normalized: S(`pn-${i}`), numberType: "oem", isPrimary: true }] },
      },
    });
    partIds.push(part.id);
    const listing = await db.listing.create({
      data: {
        internalCode: S(`LST-${i}`),
        partId: part.id,
        donorVehicleId: donorId,
        sellerId,
        priceEur: "10.00",
        condition: "used_good",
        status: "published",
        publishedAt: new Date(Date.now() - i * 1000),
        photos: { create: [1, 2].map((n) => ({ url: `https://x/p-${i}-${n}.jpg`, displayOrder: n })) },
        defects: { create: [{ description: "scratch", displayOrder: 0 }] },
      },
    });
    listingIds.push(listing.id);
    if (i === 0) listingCode = listing.internalCode;
  }
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: donorId } });
  await db.seller.deleteMany({ where: { id: sellerId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

describe("buyer-facing reads ask the database once", () => {
  it("the listing page", async () => {
    const { result, statements } = await countQueries((c) => getListingDetail(c, listingCode, null));
    expect(result).not.toBeNull();
    expect(statements).toBe(1);
  });

  it("the more-from-this-car section", async () => {
    const { result, statements } = await countQueries((c) =>
      getSiblingListings(c, { donorVehicleId: donorId, excludeListingId: listingIds[0] }),
    );
    expect(result).toHaveLength(3);
    expect(statements).toBe(1);
  });

  it("the seller profile", async () => {
    const { result, statements } = await countQueries((c) => getSellerProfile(c, sellerId, null));
    expect(result).not.toBeNull();
    expect(statements).toBe(1);
  });

  it("the seller's cars tab", async () => {
    const { result, statements } = await countQueries((c) => listSellerCars(c, sellerId, {}));
    expect(result.cars).toHaveLength(1);
    expect(statements).toBe(1);
  });

  it("the donor-vehicle page", async () => {
    const { result, statements } = await countQueries((c) => getDonorVehiclePage(c, donorId));
    expect(result).not.toBeNull();
    expect(statements).toBe(1);
  });

  it("browse", async () => {
    const { result, statements } = await countQueries((c) => browseListings(c, { sellerId }));
    expect(result.rows).toHaveLength(4);
    expect(statements).toBe(1);
  });
});
