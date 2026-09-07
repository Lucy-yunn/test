import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { db } from "../db";
import {
  addListingPhoto,
  addDonorVehiclePhoto,
  removeListingPhoto,
  moveListingPhoto,
  PHOTO_SOFT_CAP,
  type PhotoStore,
} from "./photos";
import { createDonorVehicle } from "./donor-vehicles";
import { createListing } from "./listings";
import { createPart } from "./parts";
import { InvariantError, NotFoundError } from "../dal/errors";

const TAG = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** In-memory store — records what would go to Blob. */
const uploaded = new Map<string, { data: Buffer; contentType: string }>();
const deleted: string[] = [];
const fakeStore: PhotoStore = {
  async upload(key, data, contentType) {
    uploaded.set(key, { data, contentType });
    return { url: `https://fake.blob/${key}` };
  },
  async delete(url) {
    deleted.push(url);
  },
};

const bigPng = () =>
  sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#357" } })
    .png()
    .toBuffer();

let listingId: string;
let donorVehicleId: string;
const partIds: string[] = [];

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: `Mk ${TAG}`, slug: `mk-${TAG}` } });
  const mg = await db.vehicleModelGroup.create({ data: { name: `MG ${TAG}`, slug: `mg-${TAG}`, makeId: make.id } });
  const gen = await db.vehicleGeneration.create({ data: { label: `Gen ${TAG}`, slug: `gen-${TAG}`, modelGroupId: mg.id } });
  const group = await db.group.create({ data: { name: `Gr ${TAG}`, slug: `gr-${TAG}`, displayOrder: 960 } });
  const cat = await db.category.create({ data: { name: `Cat ${TAG}`, slug: `cat-${TAG}`, groupId: group.id, displayOrder: 1 } });
  const seller = await db.seller.create({ data: { displayName: `S ${TAG}`, contactName: "S", contactEmail: `s-${TAG}@x.test`, locationCity: "Sofia" } });
  donorVehicleId = (await createDonorVehicle(db, { sellerId: seller.id, generationId: gen.id, label: `Donor ${TAG}` })).id;
  const part = await createPart(db, { categoryId: cat.id, name: `Part ${TAG}` });
  partIds.push(part.id);
  listingId = (await createListing(db, { donorVehicleId, partId: part.id, priceEur: "50.00", condition: "used_good" })).id;
});

afterAll(async () => {
  await db.listingPhoto.deleteMany({ where: { listingId } });
  await db.donorVehiclePhoto.deleteMany({ where: { donorVehicleId } });
  await db.listing.deleteMany({ where: { id: listingId } });
  await db.donorVehicle.deleteMany({ where: { label: { contains: TAG } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.seller.deleteMany({ where: { contactEmail: { contains: TAG } } });
  await db.category.deleteMany({ where: { slug: `cat-${TAG}` } });
  await db.group.deleteMany({ where: { slug: `gr-${TAG}` } });
  await db.vehicleGeneration.deleteMany({ where: { slug: `gen-${TAG}` } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: `mg-${TAG}` } });
  await db.vehicleMake.deleteMany({ where: { slug: `mk-${TAG}` } });
  await db.$disconnect();
});

describe("addListingPhoto", () => {
  it("downscales, uploads, and stores the URL with an incrementing order", async () => {
    const img = await bigPng();
    const a = await addListingPhoto(db, fakeStore, { listingId, image: img, caption: "front" });
    const b = await addListingPhoto(db, fakeStore, { listingId, image: img });

    const rows = await db.listingPhoto.findMany({ where: { listingId }, orderBy: { displayOrder: "asc" } });
    expect(rows.map((r) => r.id)).toEqual([a.id, b.id]);
    expect(rows[0].displayOrder).toBe(0);
    expect(rows[1].displayOrder).toBe(1);
    expect(rows[0].url).toMatch(/^https:\/\/fake\.blob\/listings\//);

    // what reached the store is JPEG and ≤2000px
    const key = a.url.replace("https://fake.blob/", "");
    const stored = uploaded.get(key)!;
    expect(stored.contentType).toBe("image/jpeg");
    const meta = await sharp(stored.data).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(2000);
  });

  it("enforces the soft cap", async () => {
    const existing = await db.listingPhoto.count({ where: { listingId } });
    const img = await bigPng();
    for (let i = existing; i < PHOTO_SOFT_CAP; i++) {
      await addListingPhoto(db, fakeStore, { listingId, image: img });
    }
    await expect(
      addListingPhoto(db, fakeStore, { listingId, image: img }),
    ).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("moveListingPhoto / removeListingPhoto", () => {
  it("swaps order with a neighbour and no-ops at the edge", async () => {
    const [first, second] = await db.listingPhoto.findMany({
      where: { listingId },
      orderBy: { displayOrder: "asc" },
      take: 2,
      select: { id: true },
    });
    await moveListingPhoto(db, second.id, "up");
    const reordered = await db.listingPhoto.findMany({
      where: { listingId },
      orderBy: { displayOrder: "asc" },
      take: 2,
      select: { id: true },
    });
    expect(reordered.map((r) => r.id)).toEqual([second.id, first.id]);
    await moveListingPhoto(db, second.id, "up"); // already first — no throw
  });

  it("deletes the row and calls the store", async () => {
    const row = await db.listingPhoto.findFirstOrThrow({ where: { listingId } });
    await removeListingPhoto(db, fakeStore, row.id);
    expect(await db.listingPhoto.findUnique({ where: { id: row.id } })).toBeNull();
    expect(deleted).toContain(row.url);
    await expect(removeListingPhoto(db, fakeStore, row.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("addDonorVehiclePhoto", () => {
  it("attaches to the donor vehicle", async () => {
    const r = await addDonorVehiclePhoto(db, fakeStore, { donorVehicleId, image: await bigPng() });
    expect(r.url).toMatch(/donor-vehicles\//);
    expect(await db.donorVehiclePhoto.count({ where: { donorVehicleId } })).toBe(1);
  });
});
