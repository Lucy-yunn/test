import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import {
  getMakes,
  getModelGroups,
  getGenerations,
  getGroupedCategories,
  getInStockCategories,
  resolveBrowseContext,
} from "./catalogue";
import { browseListings } from "./browse";

const TAG = `brw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let makeId: string;
let mgId: string;
let genA: string;
let genB: string;
let catAlt: string; // "alternator"-like
let catHl: string; // "headlight"-like
let sellerId: string;
const listingIds: string[] = [];
const donorIds: string[] = [];
const partIds: string[] = [];

async function donor(genId: string, over: Record<string, unknown> = {}) {
  const d = await db.donorVehicle.create({
    data: { sellerId, generationId: genId, label: S(`donor-${donorIds.length}`), ...over },
  });
  donorIds.push(d.id);
  return d.id;
}
async function part(categoryId: string) {
  const p = await db.part.create({
    data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S("part") },
  });
  partIds.push(p.id);
  return p.id;
}
async function listing(
  donorVehicleId: string,
  partId: string,
  price: string,
  condition: "new" | "used_good" | "needs_repair",
  daysAgo: number,
  status: "published" | "reserved" | "draft" = "published",
) {
  const l = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId,
      donorVehicleId,
      sellerId,
      priceEur: price,
      condition,
      status,
      publishedAt: status === "draft" ? null : new Date(Date.now() - daysAgo * 8.64e7),
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(l.id);
  return l.id;
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Make"), slug: S("make") } });
  makeId = make.id;
  const mg = await db.vehicleModelGroup.create({
    data: { name: S("Model"), slug: S("model"), makeId },
  });
  mgId = mg.id;
  genA = (await db.vehicleGeneration.create({ data: { label: S("Gen A"), slug: S("gen-a"), modelGroupId: mgId, productionStart: 2005 } })).id;
  genB = (await db.vehicleGeneration.create({ data: { label: S("Gen B"), slug: S("gen-b"), modelGroupId: mgId, productionStart: 2012 } })).id;

  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 970 } });
  catAlt = (await db.category.create({ data: { name: S("Alt"), slug: S("alt"), groupId: group.id, displayOrder: 1 } })).id;
  catHl = (await db.category.create({ data: { name: S("HL"), slug: S("hl"), groupId: group.id, displayOrder: 2 } })).id;

  sellerId = (await db.seller.create({ data: { displayName: S("Seller"), contactName: "S", contactEmail: `${TAG}@x.test`, locationCity: "Sofia" } })).id;

  const dA1 = await donor(genA, { engine: "1.6 TDI", fuel: "Diesel", transmission: "manual", mileageKm: 214000 });
  const dA2 = await donor(genA, { engine: "2.0 TDI", fuel: "Diesel", transmission: "automatic" });
  const dB1 = await donor(genB, { engine: "1.4 TSI", fuel: "Petrol", transmission: "manual" });

  // alternators
  await listing(dA1, await part(catAlt), "100.00", "used_good", 5);
  await listing(dA2, await part(catAlt), "250.00", "needs_repair", 2);
  await listing(dB1, await part(catAlt), "150.00", "new", 1);
  // headlight on gen A
  await listing(dA1, await part(catHl), "80.00", "used_good", 3);
  // a draft alternator on gen A — must NOT appear
  await listing(dA1, await part(catAlt), "999.00", "used_good", 0, "draft");
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.seller.deleteMany({ where: { id: sellerId } });
  await db.category.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.group.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.vehicleGeneration.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.vehicleMake.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.$disconnect();
});

describe("catalogue reads", () => {
  it("walks make → model group → generations (year-ordered) → grouped categories", async () => {
    expect((await getMakes(db)).some((m) => m.slug === S("make"))).toBe(true);
    const mgs = await getModelGroups(db, S("make"));
    expect(mgs.map((m) => m.slug)).toContain(S("model"));
    const gens = await getGenerations(db, S("model"));
    expect(gens.map((g) => g.slug)).toEqual([S("gen-a"), S("gen-b")]); // 2005 before 2012
    const grouped = await getGroupedCategories(db);
    const mine = grouped.find((g) => g.groupSlug === S("grp"));
    expect(mine?.categories.map((c) => c.slug)).toEqual([S("alt"), S("hl")]);
  });

  it("resolveBrowseContext validates the chain", async () => {
    const ok = await resolveBrowseContext(db, { make: S("make"), model: S("model"), generation: S("gen-a"), category: S("alt") });
    expect(ok?.generation?.slug).toBe(S("gen-a"));
    expect(ok?.category?.name).toBe(S("Alt"));
    expect(await resolveBrowseContext(db, { make: S("make"), model: "nope" })).toBeNull();
    expect(await resolveBrowseContext(db, { make: S("make"), model: S("model"), generation: "wrong-gen" })).toBeNull();
  });

  it("getInStockCategories counts buyer-visible listings per category", async () => {
    const inStock = await getInStockCategories(db);
    const alt = inStock.find((c) => c.slug === S("alt"));
    expect(alt?.count).toBe(3); // the draft is excluded
  });
});

describe("browseListings — provenance match", () => {
  it("full funnel: category + exact generation, draft excluded", async () => {
    const r = await browseListings(db, { categoryId: catAlt, generationId: genA });
    expect(r.total).toBe(2); // the two gen-A alternators, not the gen-B one, not the draft
    expect(r.rows.every((x) => x.title === S("part"))).toBe(true);
  });

  it("row carries donor mileage, null when the donor has none", async () => {
    const r = await browseListings(db, { categoryId: catAlt, generationId: genA });
    const withKm = r.rows.find((x) => Number(x.priceEur) === 100);
    const noKm = r.rows.find((x) => Number(x.priceEur) === 250);
    expect(withKm?.donor.mileageKm).toBe(214000);
    expect(noKm?.donor.mileageKm).toBeNull();
  });

  it("partial funnel: any generation of the model group", async () => {
    const r = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId });
    expect(r.total).toBe(3);
    // generations facet available with counts
    expect(r.facets.generations.map((f) => f.count).reduce((a, b) => a + b)).toBe(3);
  });

  it("default sort is newest first", async () => {
    const r = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId });
    const dates = r.rows.map((x) => x.publishedAt!.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("price sort", async () => {
    const asc = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId, sort: "price_asc" });
    expect(asc.rows.map((x) => Number(x.priceEur))).toEqual([100, 150, 250]);
  });

  it("facets: engine/fuel/transmission from the donor, null never matches", async () => {
    const r = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId });
    expect(r.facets.fuels.find((f) => f.value === "Diesel")?.count).toBe(2);
    expect(r.facets.fuels.find((f) => f.value === "Petrol")?.count).toBe(1);
    expect(r.facets.transmissions.find((f) => f.value === "automatic")?.count).toBe(1);

    const filtered = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId, fuel: "Petrol" });
    expect(filtered.total).toBe(1);
    // the fuel facet still shows both options (its own filter dropped for its count)
    expect(filtered.facets.fuels.length).toBe(2);
  });

  it("generation facet narrows a partial funnel", async () => {
    const r = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId, generationId: genB });
    expect(r.total).toBe(1);
  });

  it("pagination", async () => {
    const r = await browseListings(db, { categoryId: catAlt, modelGroupId: mgId, page: 2 });
    expect(r.page).toBe(2);
    expect(r.pageCount).toBe(1);
    expect(r.rows.length).toBe(0);
  });
});
