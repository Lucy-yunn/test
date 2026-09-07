import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { createDonorVehicle, updateDonorVehicle } from "./donor-vehicles";
import {
  createListing,
  updateListing,
  addListingDefect,
  removeListingDefect,
  getPublishChecklist,
  publishListing,
  setListingStatusByStaff,
} from "./listings";
import { createPart } from "./parts";
import { InvariantError, NotFoundError } from "../dal/errors";

const TAG = `lst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
let sellerA: string;
let sellerB: string;
let generationId: string;
let categoryId: string;
let donorA: string;
let partId: string;
const listingIds: string[] = [];
const partIds: string[] = [];

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: `Mk ${TAG}`, slug: `mk-${TAG}` } });
  const mg = await db.vehicleModelGroup.create({
    data: { name: `MG ${TAG}`, slug: `mg-${TAG}`, makeId: make.id },
  });
  generationId = (
    await db.vehicleGeneration.create({
      data: { label: `Gen ${TAG}`, slug: `gen-${TAG}`, modelGroupId: mg.id },
    })
  ).id;

  const group = await db.group.create({ data: { name: `Gr ${TAG}`, slug: `gr-${TAG}`, displayOrder: 950 } });
  categoryId = (
    await db.category.create({ data: { name: `Cat ${TAG}`, slug: `cat-${TAG}`, groupId: group.id, displayOrder: 1 } })
  ).id;

  sellerA = (await db.seller.create({ data: { displayName: `A ${TAG}`, contactName: "A", contactEmail: `a-${TAG}@x.test`, locationCity: "Sofia" } })).id;
  sellerB = (await db.seller.create({ data: { displayName: `B ${TAG}`, contactName: "B", contactEmail: `b-${TAG}@x.test`, locationCity: "Varna" } })).id;

  donorA = (await createDonorVehicle(db, { sellerId: sellerA, generationId, label: `Donor ${TAG}` })).id;
  partId = (await createPart(db, { categoryId, name: `Part ${TAG}` })).id;
  partIds.push(partId);
});

afterAll(async () => {
  await db.listingDefect.deleteMany({ where: { listingId: { in: listingIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.donorVehicle.deleteMany({ where: { label: { contains: TAG } } });
  await db.partNumber.deleteMany({ where: { partId: { in: partIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.seller.deleteMany({ where: { id: { in: [sellerA, sellerB] } } });
  await db.category.deleteMany({ where: { slug: `cat-${TAG}` } });
  await db.group.deleteMany({ where: { slug: `gr-${TAG}` } });
  await db.vehicleGeneration.deleteMany({ where: { slug: `gen-${TAG}` } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: `mg-${TAG}` } });
  await db.vehicleMake.deleteMany({ where: { slug: `mk-${TAG}` } });
  await db.$disconnect();
});

async function mkListing(over: Partial<Parameters<typeof createListing>[1]> = {}) {
  const l = await createListing(db, {
    donorVehicleId: donorA,
    partId,
    priceEur: "125.00",
    condition: "used_good",
    ...over,
  });
  listingIds.push(l.id);
  return l;
}

async function mkPart(name: string) {
  const p = await createPart(db, { categoryId, name: `${name} ${TAG}` });
  partIds.push(p.id);
  return p.id;
}

describe("createDonorVehicle / updateDonorVehicle", () => {
  it("requires a real seller and generation", async () => {
    await expect(
      createDonorVehicle(db, { sellerId: "nope", generationId, label: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      createDonorVehicle(db, { sellerId: sellerA, generationId: "nope", label: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("stores structured detail and trims blanks to null", async () => {
    const { id } = await createDonorVehicle(db, {
      sellerId: sellerA,
      generationId,
      label: `Structured ${TAG}`,
      engine: "2.0 TDI",
      engineCode: "  ",
      transmission: "manual",
    });
    const row = await db.donorVehicle.findUnique({ where: { id } });
    expect(row?.engine).toBe("2.0 TDI");
    expect(row?.engineCode).toBeNull();
    expect(row?.transmission).toBe("manual");
    await updateDonorVehicle(db, id, { mileageKm: 210000 });
    expect((await db.donorVehicle.findUnique({ where: { id } }))?.mileageKm).toBe(210000);
  });
});

describe("createListing — sellerId == donorVehicle.sellerId", () => {
  it("derives sellerId from the donor vehicle and allocates an LST code", async () => {
    const l = await mkListing();
    const row = await db.listing.findUnique({ where: { id: l.id } });
    expect(row?.sellerId).toBe(sellerA);
    expect(row?.status).toBe("draft");
    expect(l.internalCode).toMatch(/^LST-\d{6}$/);
  });

  it("rejects a part that doesn't exist", async () => {
    await expect(mkListing({ partId: "nope" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a listing with unknown (blank / whitespace / null / undefined) measurements", async () => {
    const l = await mkListing({
      lengthCm: "",
      widthCm: "   ",
      heightCm: null,
      weightKg: undefined,
      packageSizeNotes: "",
    });
    const row = await db.listing.findUnique({
      where: { id: l.id },
      select: { lengthCm: true, widthCm: true, heightCm: true, weightKg: true, packageSizeNotes: true },
    });
    expect(row?.lengthCm).toBeNull();
    expect(row?.widthCm).toBeNull();
    expect(row?.heightCm).toBeNull();
    expect(row?.weightKg).toBeNull();
    expect(row?.packageSizeNotes).toBeNull();
  });

  it("keeps supplied decimal measurements, including zero", async () => {
    const l = await mkListing({ lengthCm: "42.50", widthCm: "0", weightKg: "0.750" });
    const row = await db.listing.findUnique({
      where: { id: l.id },
      select: { lengthCm: true, widthCm: true, weightKg: true },
    });
    expect(Number(row?.lengthCm)).toBe(42.5);
    expect(Number(row?.widthCm)).toBe(0);
    expect(Number(row?.weightKg)).toBe(0.75);
  });

  it("updateListing clears a set measurement when passed a blank string", async () => {
    const l = await mkListing({ lengthCm: "10.00" });
    expect(Number((await db.listing.findUnique({ where: { id: l.id }, select: { lengthCm: true } }))?.lengthCm)).toBe(10);

    await updateListing(db, l.id, { lengthCm: "", weightKg: "  " });
    const row = await db.listing.findUnique({
      where: { id: l.id },
      select: { lengthCm: true, weightKg: true },
    });
    expect(row?.lengthCm).toBeNull();
    expect(row?.weightKg).toBeNull();
  });
});

describe("publish checklist", () => {
  it("blocks publish until every item passes, then transitions", async () => {
    const l = await mkListing({ priceEur: "0.00" });

    let check = await getPublishChecklist(db, l.id);
    expect(check.ok).toBe(false);
    await expect(publishListing(db, l.id)).rejects.toBeInstanceOf(InvariantError);

    // fix price, add a photo, add a part number
    await updateListing(db, l.id, { priceEur: "99.00" });
    await db.listingPhoto.create({ data: { listingId: l.id, url: "https://x/p.jpg", displayOrder: 0 } });
    await db.partNumber.create({
      data: { partId, raw: `PN-${TAG}`, normalized: `PN${TAG}`.toUpperCase(), numberType: "oem" },
    });

    check = await getPublishChecklist(db, l.id);
    expect(check.ok).toBe(true);

    await publishListing(db, l.id, "staff-1");
    const row = await db.listing.findUnique({ where: { id: l.id } });
    expect(row?.status).toBe("published");
    expect(row?.publishedAt).toBeTruthy();
    expect(row?.reviewedBy).toBe("staff-1");
  });

  it("accepts the 'no visible number' tick", async () => {
    const l = await mkListing({ noVisiblePartNumber: true });
    await db.listingPhoto.create({ data: { listingId: l.id, url: "https://x/p.jpg", displayOrder: 0 } });
    // note: partId here has a PartNumber from the previous test; use a fresh part
    await updateListing(db, l.id, { partId: await mkPart("Fresh") });
    expect((await getPublishChecklist(db, l.id)).ok).toBe(true);
  });
});

describe("staff status transitions", () => {
  it("allows published↔cancelled and →archived, refuses reserved/sold/draft jumps", async () => {
    const l = await mkListing();
    await db.listingPhoto.create({ data: { listingId: l.id, url: "https://x/p.jpg", displayOrder: 0 } });
    await updateListing(db, l.id, { noVisiblePartNumber: true, partId: await mkPart("P2") });
    await publishListing(db, l.id);

    await setListingStatusByStaff(db, l.id, "cancelled");
    expect((await db.listing.findUnique({ where: { id: l.id } }))?.status).toBe("cancelled");
    await setListingStatusByStaff(db, l.id, "published");

    await expect(setListingStatusByStaff(db, l.id, "reserved")).rejects.toBeInstanceOf(InvariantError);
    await expect(setListingStatusByStaff(db, l.id, "sold")).rejects.toBeInstanceOf(InvariantError);

    await setListingStatusByStaff(db, l.id, "archived");
    expect((await db.listing.findUnique({ where: { id: l.id } }))?.status).toBe("archived");
  });
});

describe("defects", () => {
  it("adds and removes defect rows with display order", async () => {
    const l = await mkListing();
    const d1 = await addListingDefect(db, l.id, "Cracked bracket");
    const d2 = await addListingDefect(db, l.id, "Scuffed paint");
    const rows = await db.listingDefect.findMany({ where: { listingId: l.id }, orderBy: { displayOrder: "asc" } });
    expect(rows.map((r) => r.description)).toEqual(["Cracked bracket", "Scuffed paint"]);
    expect(rows[1].displayOrder).toBe(1);
    await removeListingDefect(db, d1.id);
    expect(await db.listingDefect.count({ where: { listingId: l.id } })).toBe(1);
    void d2;
  });
});
