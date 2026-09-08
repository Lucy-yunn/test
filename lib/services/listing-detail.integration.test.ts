import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { getListingDetail, getSiblingListings } from "./listing-detail";

const TAG = `ld-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let donorId: string;
let otherDonorId: string;
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];
let sellerId: string;
let categoryId: string;

async function part() {
  const p = await db.part.create({
    data: {
      internalCode: S(`PRT-${partIds.length}`),
      categoryId,
      name: S("part"),
      partNumbers: {
        create: [
          { raw: "sec-ondary", normalized: "SECONDARY", numberType: "aftermarket", isPrimary: false },
          { raw: "PRIM 001", normalized: "PRIM001", numberType: "oem", isPrimary: true },
        ],
      },
    },
  });
  partIds.push(p.id);
  return p.id;
}

async function listing(
  donor: string,
  price: string,
  status: "published" | "reserved" | "draft" | "sold",
  daysAgo: number,
) {
  const l = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: await part(),
      donorVehicleId: donor,
      sellerId,
      priceEur: price,
      condition: "used_good",
      status,
      publishedAt: status === "draft" ? null : new Date(Date.now() - daysAgo * 8.64e7),
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(l.id);
  return l;
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  const gen = await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } });
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 980 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
  sellerId = (await db.seller.create({ data: { displayName: S("Seller"), contactName: "S", contactEmail: `${TAG}@x.test`, locationCity: "Sofia" } })).id;

  donorId = (await db.donorVehicle.create({
    data: {
      sellerId, generationId: gen.id, label: S("donor"),
      donorYear: 2012, vin: "WVWZZZ1KZ9W123456", mileageKm: 190000,
      engine: "2.0 TDI", engineCode: "CFFB", fuel: "Diesel", transmission: "manual",
    },
  })).id;
  otherDonorId = (await db.donorVehicle.create({ data: { sellerId, generationId: gen.id, label: S("other") } })).id;
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.donorVehicle.deleteMany({ where: { label: { startsWith: TAG } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.seller.deleteMany({ where: { id: sellerId } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

describe("getListingDetail", () => {
  it("returns a buyer-visible listing with masked VIN and primary-first part numbers", async () => {
    const l = await listing(donorId, "120.00", "published", 5);
    const detail = await getListingDetail(db, l.internalCode);
    expect(detail?.donor.maskedVin).toBe("WVW••••••••••3456");
    expect(detail?.donor.year).toBe(2012);
    expect(detail?.donor.makeName).toBe(S("Mk"));
    expect(detail?.part.numbers[0].isPrimary).toBe(true);
    expect(detail?.part.numbers.map((n) => n.raw)).toEqual(["PRIM 001", "sec-ondary"]);
    // vinDerivedNotes must never be part of the returned shape
    expect(JSON.stringify(detail)).not.toContain("vinDerived");
  });

  it("returns null for a draft listing and for an unknown code", async () => {
    const draft = await listing(donorId, "1.00", "draft", 0);
    expect(await getListingDetail(db, draft.internalCode)).toBeNull();
    expect(await getListingDetail(db, "LST-000000")).toBeNull();
  });
});

describe("getSiblingListings — more parts from the same car", () => {
  it("returns other published/reserved listings on the donor, newest first, excluding self", async () => {
    const anchor = await listing(donorId, "50.00", "published", 10);
    const newer = await listing(donorId, "60.00", "published", 1);
    const reserved = await listing(donorId, "70.00", "reserved", 3);
    await listing(donorId, "80.00", "draft", 0); // hidden
    await listing(donorId, "90.00", "sold", 0); // hidden
    await listing(otherDonorId, "100.00", "published", 0); // different car

    const sibs = await getSiblingListings(db, {
      donorVehicleId: donorId,
      excludeListingId: anchor.id,
    });
    const codes = sibs.map((s) => s.internalCode);
    expect(codes).toContain(newer.internalCode);
    expect(codes).toContain(reserved.internalCode);
    expect(codes).not.toContain(anchor.internalCode);
    // newest publishedAt first
    expect(codes[0]).toBe(newer.internalCode);
    // no draft / sold / other-car
    expect(sibs.every((s) => s.status === "published" || s.status === "reserved")).toBe(true);
  });

  it("returns [] when the car's only other listings are hidden (draft/sold)", async () => {
    const lone = await db.donorVehicle.create({
      data: { sellerId, generationId: (await db.vehicleGeneration.findFirstOrThrow({ where: { slug: S("gen") } })).id, label: S("lone") },
    });
    donorIds.push(lone.id);
    const anchor = await listing(lone.id, "10.00", "published", 0);
    await listing(lone.id, "11.00", "draft", 0);
    await listing(lone.id, "12.00", "sold", 0);
    expect(
      await getSiblingListings(db, { donorVehicleId: lone.id, excludeListingId: anchor.id }),
    ).toHaveLength(0);
  });
});
