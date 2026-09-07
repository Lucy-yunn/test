import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  assertSellerOwnsDonorVehicle,
  assertCategoryHasNoParts,
  findConflictingPartNumber,
} from "./invariants";
import { InvariantError, NotFoundError } from "./errors";
import { normalizePartNumber } from "./part-number";

// Unique suffix so parallel-safe and re-runnable without a wipe.
const TAG = `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

let sellerA: string;
let sellerB: string;
let donorA: string;
let generationId: string;
let emptyCategoryId: string;
let usedCategoryId: string;
let partId: string;

beforeAll(async () => {
  const make = await db.vehicleMake.create({
    data: { name: `Make ${TAG}`, slug: `make-${TAG}` },
  });
  const mg = await db.vehicleModelGroup.create({
    data: { name: `MG ${TAG}`, slug: `mg-${TAG}`, makeId: make.id },
  });
  const gen = await db.vehicleGeneration.create({
    data: { label: `Gen ${TAG}`, slug: `gen-${TAG}`, modelGroupId: mg.id },
  });
  generationId = gen.id;

  const group = await db.group.create({
    data: { name: `Grp ${TAG}`, slug: `grp-${TAG}`, displayOrder: 999 },
  });
  const empty = await db.category.create({
    data: { name: `Empty ${TAG}`, slug: `empty-${TAG}`, groupId: group.id, displayOrder: 1 },
  });
  const used = await db.category.create({
    data: { name: `Used ${TAG}`, slug: `used-${TAG}`, groupId: group.id, displayOrder: 2 },
  });
  emptyCategoryId = empty.id;
  usedCategoryId = used.id;

  const a = await db.seller.create({
    data: {
      displayName: `Seller A ${TAG}`,
      contactName: "A",
      contactEmail: `a-${TAG}@x.test`,
      locationCity: "Sofia",
    },
  });
  const b = await db.seller.create({
    data: {
      displayName: `Seller B ${TAG}`,
      contactName: "B",
      contactEmail: `b-${TAG}@x.test`,
      locationCity: "Plovdiv",
    },
  });
  sellerA = a.id;
  sellerB = b.id;

  const dv = await db.donorVehicle.create({
    data: { sellerId: sellerA, generationId, label: `Donor ${TAG}` },
  });
  donorA = dv.id;

  const part = await db.part.create({
    data: {
      internalCode: `PRT-${TAG}`,
      categoryId: usedCategoryId,
      name: `Part ${TAG}`,
      partNumbers: {
        create: {
          raw: "1K0 820 859 S",
          normalized: normalizePartNumber("1K0 820 859 S"),
          numberType: "oem",
          isPrimary: true,
        },
      },
    },
  });
  partId = part.id;
});

afterAll(async () => {
  await db.partNumber.deleteMany({ where: { part: { internalCode: `PRT-${TAG}` } } });
  await db.part.deleteMany({ where: { internalCode: `PRT-${TAG}` } });
  await db.donorVehicle.deleteMany({ where: { label: `Donor ${TAG}` } });
  await db.seller.deleteMany({ where: { contactEmail: { contains: TAG } } });
  await db.category.deleteMany({ where: { slug: { contains: TAG } } });
  await db.group.deleteMany({ where: { slug: `grp-${TAG}` } });
  await db.vehicleGeneration.deleteMany({ where: { slug: `gen-${TAG}` } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: `mg-${TAG}` } });
  await db.vehicleMake.deleteMany({ where: { slug: `make-${TAG}` } });
  await db.$disconnect();
});

describe("assertSellerOwnsDonorVehicle (Listing.sellerId == DonorVehicle.sellerId)", () => {
  it("passes when the seller owns the donor vehicle", async () => {
    await expect(
      assertSellerOwnsDonorVehicle(db, { sellerId: sellerA, donorVehicleId: donorA }),
    ).resolves.toBeUndefined();
  });

  it("throws InvariantError when another seller's donor vehicle is used", async () => {
    await expect(
      assertSellerOwnsDonorVehicle(db, { sellerId: sellerB, donorVehicleId: donorA }),
    ).rejects.toBeInstanceOf(InvariantError);
  });

  it("throws NotFoundError for an unknown donor vehicle", async () => {
    await expect(
      assertSellerOwnsDonorVehicle(db, { sellerId: sellerA, donorVehicleId: "missing" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("assertCategoryHasNoParts", () => {
  it("passes for a category with no parts", async () => {
    await expect(assertCategoryHasNoParts(db, emptyCategoryId)).resolves.toBeUndefined();
  });

  it("throws InvariantError for a category that still classifies parts", async () => {
    await expect(assertCategoryHasNoParts(db, usedCategoryId)).rejects.toBeInstanceOf(
      InvariantError,
    );
  });
});

describe("findConflictingPartNumber (intake de-dup)", () => {
  it("finds an existing part by normalized number regardless of separators/case", async () => {
    const hit = await findConflictingPartNumber(db, normalizePartNumber("1k0-820-859-s"));
    expect(hit?.partId).toBe(partId);
    expect(hit?.internalCode).toBe(`PRT-${TAG}`);
  });

  it("returns null when nothing matches", async () => {
    expect(await findConflictingPartNumber(db, "NOSUCHNUMBER999")).toBeNull();
  });

  it("excludes the part being edited", async () => {
    const hit = await findConflictingPartNumber(db, normalizePartNumber("1K0820859S"), {
      excludePartId: partId,
    });
    expect(hit).toBeNull();
  });
});
