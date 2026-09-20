import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { getSellerProfile, listSellerCars, getDonorVehiclePage } from "./seller-profile";

const TAG = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;
const PHONE = "+359 88 555 0101";
const DAY = 86_400_000;

let generationId: string;
let categoryId: string;
const sellerIds: string[] = [];
const userIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];
const extraMakeSlugs: string[] = [];

type Status = "published" | "reserved" | "draft" | "sold" | "cancelled" | "archived";

interface SellerOpts {
  login?: "active" | "banned" | "none";
  avatarUrl?: string | null;
  lastActiveAt?: Date | null;
  city?: string;
}

async function mkSeller(name: string, opts: SellerOpts = {}) {
  const login = opts.login ?? "active";
  let userId: string | null = null;
  if (login !== "none") {
    const user = await db.user.create({
      data: { name: S(name), email: `${name}-${TAG}@example.test`, role: "seller", banned: login === "banned" },
    });
    userIds.push(user.id);
    userId = user.id;
  }
  const seller = await db.seller.create({
    data: {
      displayName: S(name),
      contactName: "Contact",
      contactEmail: `${name}-${TAG}@x.test`,
      contactPhone: PHONE,
      locationCity: opts.city ?? "Sofia",
      avatarUrl: opts.avatarUrl ?? null,
      lastActiveAt: opts.lastActiveAt ?? null,
      userId,
    },
  });
  sellerIds.push(seller.id);
  return seller.id;
}

async function mkDonor(sellerId: string, extra: Record<string, unknown> = {}) {
  const d = await db.donorVehicle.create({
    data: { sellerId, generationId, label: S(`car-${donorIds.length}`), ...extra },
  });
  donorIds.push(d.id);
  return d.id;
}

async function mkListing(donorVehicleId: string, sellerId: string, status: Status, publishedAt: Date | null = new Date()) {
  const part = await db.part.create({
    data: { internalCode: S(`PRT-${partIds.length}`), categoryId, name: S(`part-${partIds.length}`) },
  });
  partIds.push(part.id);
  const l = await db.listing.create({
    data: {
      internalCode: S(`LST-${listingIds.length}`),
      partId: part.id,
      donorVehicleId,
      sellerId,
      priceEur: "100.00",
      condition: "used_good",
      status,
      publishedAt: status === "draft" ? null : publishedAt,
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(l.id);
  return l;
}

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 940 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
});

afterAll(async () => {
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: { startsWith: TAG } } });
  await db.vehicleMake.deleteMany({ where: { slug: { in: [S("mk"), ...extraMakeSlugs] } } });
  await db.$disconnect();
});

const signedIn: Actor = { userId: "u-1", role: "buyer", buyerId: "b-1", sellerId: null, messagingBlocked: false };

describe("getSellerProfile — the public header (docs/seller-profile.md §2)", () => {
  it("returns the seller's public details, with 'on IVO since' = the earliest publish date", async () => {
    const lastActive = new Date("2026-09-10T08:00:00Z");
    const id = await mkSeller("full", { avatarUrl: "https://x/a.jpg", lastActiveAt: lastActive, city: "Aytos" });
    const donor = await mkDonor(id);
    const first = new Date(Date.now() - 30 * DAY);
    await mkListing(donor, id, "published", new Date(Date.now() - 2 * DAY));
    await mkListing(donor, id, "sold", first);

    const profile = await getSellerProfile(db, id, signedIn);

    expect(profile).toMatchObject({
      id,
      name: S("full"),
      avatarUrl: "https://x/a.jpg",
      city: "Aytos",
      country: "BG",
      lastActiveAt: lastActive,
      onIvoSince: first,
    });
  });

  it("has no profile for an unknown seller", async () => {
    expect(await getSellerProfile(db, "nope", signedIn)).toBeNull();
  });

  it("has no profile when the seller has no login, or the login is disabled", async () => {
    for (const login of ["none", "banned"] as const) {
      const id = await mkSeller(`unavail-${login}`, { login });
      await mkListing(await mkDonor(id), id, "published");
      expect(await getSellerProfile(db, id, signedIn)).toBeNull();
    }
  });

  it("has no profile until the seller has published something", async () => {
    const id = await mkSeller("drafts-only");
    await mkListing(await mkDonor(id), id, "draft");
    expect(await getSellerProfile(db, id, signedIn)).toBeNull();
  });

  it("still has a profile when everything the seller listed has since been sold", async () => {
    const id = await mkSeller("all-sold");
    await mkListing(await mkDonor(id), id, "sold");
    expect(await getSellerProfile(db, id, signedIn)).not.toBeNull();
  });
});

describe("getSellerProfile — the phone number is for signed-in users only", () => {
  it("is hidden from anonymous visitors and appears nowhere in what is returned", async () => {
    const id = await mkSeller("phone-anon");
    await mkListing(await mkDonor(id), id, "published");

    const profile = await getSellerProfile(db, id, null);

    expect(profile?.contact).toEqual({ kind: "sign_in" });
    expect(JSON.stringify(profile)).not.toContain(PHONE);
  });

  it("is shown to any signed-in user", async () => {
    const id = await mkSeller("phone-in");
    await mkListing(await mkDonor(id), id, "published");

    expect((await getSellerProfile(db, id, signedIn))?.contact).toEqual({ kind: "phone", phone: PHONE });
  });
});

/** A second make / model / generation, so filters have something to tell apart. */
async function mkOtherGeneration(name: string) {
  const make = await db.vehicleMake.create({ data: { name: S(`${name}-Mk`), slug: S(`${name}-mk`) } });
  extraMakeSlugs.push(make.slug);
  const mg = await db.vehicleModelGroup.create({ data: { name: S(`${name}-Model`), slug: S(`${name}-model`), makeId: make.id } });
  const gen = await db.vehicleGeneration.create({ data: { label: S(`${name}-Gen`), slug: S(`${name}-gen`), modelGroupId: mg.id } });
  return { id: gen.id, makeSlug: make.slug, genSlug: gen.slug };
}

describe("listSellerCars: the All Cars tab", () => {
  it("lists cars with an on-the-shelf or sold part, counting each, and hides cars with nothing visible", async () => {
    const id = await mkSeller("cars-vis");
    const shelf = await mkDonor(id);
    await mkListing(shelf, id, "published");
    await mkListing(shelf, id, "reserved");
    await mkListing(shelf, id, "sold");
    await mkListing(shelf, id, "draft");
    const soldOnly = await mkDonor(id);
    await mkListing(soldOnly, id, "sold");
    const hidden = await mkDonor(id);
    await mkListing(hidden, id, "draft");
    await mkListing(hidden, id, "cancelled");
    await mkListing(hidden, id, "archived");
    await mkDonor(id); // no parts at all

    const { cars, total } = await listSellerCars(db, id, {});

    expect(total).toBe(2);
    const byId = new Map(cars.map((c) => [c.id, c]));
    expect(byId.get(shelf)).toMatchObject({ onShelf: 2, sold: 1 });
    expect(byId.get(soldOnly)).toMatchObject({ onShelf: 0, sold: 1 });
    expect(byId.has(hidden)).toBe(false);
  });

  it("carries what the card shows: car, spec line, first line of the scrap reason, and a photo", async () => {
    const id = await mkSeller("cars-card");
    const donor = await mkDonor(id, {
      donorYear: 2012,
      engine: "2.0 TDI",
      fuel: "Diesel",
      transmission: "manual",
      mileageKm: 214000,
      scrapReason: "Flood damage in the 2023 storms\nWater reached the dashboard",
    });
    await mkListing(donor, id, "published");

    const [card] = (await listSellerCars(db, id, {})).cars;

    expect(card).toMatchObject({
      id: donor,
      makeName: S("Mk"),
      modelGroupName: S("Model"),
      generationLabel: S("Gen"),
      year: 2012,
      engine: "2.0 TDI",
      fuel: "Diesel",
      transmission: "manual",
      mileageKm: 214000,
      scrapReasonFirstLine: "Flood damage in the 2023 storms",
      photoUrl: "https://x/p.jpg", // no car photo, so the first part's photo
    });
  });

  it("prefers a photo of the car itself over a part photo", async () => {
    const id = await mkSeller("cars-photo");
    const donor = await mkDonor(id);
    await mkListing(donor, id, "published");
    await db.donorVehiclePhoto.create({ data: { donorVehicleId: donor, url: "https://x/car.jpg", displayOrder: 0 } });

    expect((await listSellerCars(db, id, {})).cars[0].photoUrl).toBe("https://x/car.jpg");
  });

  it("shows only this seller's cars", async () => {
    const mine = await mkSeller("cars-mine");
    const theirs = await mkSeller("cars-theirs");
    await mkListing(await mkDonor(mine), mine, "published");
    const otherDonor = await mkDonor(theirs);
    await mkListing(otherDonor, theirs, "published");

    const ids = (await listSellerCars(db, mine, {})).cars.map((c) => c.id);

    expect(ids).not.toContain(otherDonor);
    expect(ids).toHaveLength(1);
  });

  it("sorts newest first by default, or by most parts on the shelf", async () => {
    const id = await mkSeller("cars-sort");
    const older = await mkDonor(id);
    await mkListing(older, id, "published", new Date(Date.now() - 20 * DAY));
    await mkListing(older, id, "published", new Date(Date.now() - 19 * DAY));
    await mkListing(older, id, "published", new Date(Date.now() - 18 * DAY));
    const newer = await mkDonor(id);
    await mkListing(newer, id, "published", new Date(Date.now() - 1 * DAY));

    expect((await listSellerCars(db, id, {})).cars.map((c) => c.id)).toEqual([newer, older]);
    expect((await listSellerCars(db, id, { sort: "newest" })).cars.map((c) => c.id)).toEqual([newer, older]);
    expect((await listSellerCars(db, id, { sort: "most_parts" })).cars.map((c) => c.id)).toEqual([older, newer]);
  });

  it("filters by fuel, by mileage band (unknown mileage never matches), and by parts on the shelf", async () => {
    const id = await mkSeller("cars-filter");
    const diesel = await mkDonor(id, { fuel: "Diesel", mileageKm: 250000 });
    await mkListing(diesel, id, "published");
    const petrol = await mkDonor(id, { fuel: "Petrol", mileageKm: 90000 });
    await mkListing(petrol, id, "sold");
    const unknown = await mkDonor(id, { fuel: "Petrol" });
    await mkListing(unknown, id, "published");
    const idsOf = async (o: Parameters<typeof listSellerCars>[2]) =>
      (await listSellerCars(db, id, o)).cars.map((c) => c.id).sort();

    expect(await idsOf({ fuel: "Petrol" })).toEqual([petrol, unknown].sort());
    expect(await idsOf({ mileage: "over200k" })).toEqual([diesel]);
    expect(await idsOf({ mileage: "under100k" })).toEqual([petrol]);
    expect(await idsOf({ onShelfOnly: true })).toEqual([diesel, unknown].sort());
  });

  it("filters by make and by generation", async () => {
    const id = await mkSeller("cars-make");
    const other = await mkOtherGeneration("other");
    const base = await mkDonor(id);
    await mkListing(base, id, "published");
    const otherCar = await mkDonor(id, { generationId: other.id });
    await mkListing(otherCar, id, "published");
    const idsOf = async (o: Parameters<typeof listSellerCars>[2]) =>
      (await listSellerCars(db, id, o)).cars.map((c) => c.id);

    expect(await idsOf({ make: other.makeSlug })).toEqual([otherCar]);
    expect(await idsOf({ generation: S("gen") })).toEqual([base]);
  });

  it("offers filter choices drawn from all of the seller's visible cars, not only the filtered ones", async () => {
    const id = await mkSeller("cars-facets");
    const other = await mkOtherGeneration("facet");
    await mkListing(await mkDonor(id, { fuel: "Diesel" }), id, "published");
    await mkListing(await mkDonor(id, { generationId: other.id, fuel: "Petrol" }), id, "published");

    const { facets } = await listSellerCars(db, id, { fuel: "Diesel" });

    expect(facets.makes.map((m) => m.slug).sort()).toEqual([S("mk"), other.makeSlug].sort());
    expect(facets.generations.map((g) => g.slug).sort()).toEqual([S("gen"), other.genSlug].sort());
    expect(facets.fuels).toEqual(["Diesel", "Petrol"]);
  });
});

describe("getDonorVehiclePage: the car's ID card and its parts", () => {
  it("lists parts on the shelf first (reserved among them, newest first), sold parts last, and hides the rest", async () => {
    const id = await mkSeller("dv-order");
    const donor = await mkDonor(id);
    const oldShelf = await mkListing(donor, id, "published", new Date(Date.now() - 10 * DAY));
    const newShelf = await mkListing(donor, id, "reserved", new Date(Date.now() - 1 * DAY));
    const oldSold = await mkListing(donor, id, "sold", new Date(Date.now() - 20 * DAY));
    const newSold = await mkListing(donor, id, "sold", new Date(Date.now() - 5 * DAY));
    await mkListing(donor, id, "draft");
    await mkListing(donor, id, "cancelled");
    await mkListing(donor, id, "archived");

    const page = await getDonorVehiclePage(db, donor);

    expect(page?.parts.map((p) => [p.code, p.state])).toEqual([
      [newShelf.internalCode, "reserved"],
      [oldShelf.internalCode, "available"],
      [newSold.internalCode, "sold"],
      [oldSold.internalCode, "sold"],
    ]);
  });

  it("shows the car's details, the full scrap reason, a masked VIN, and its seller", async () => {
    const id = await mkSeller("dv-card", { avatarUrl: "https://x/a.jpg", city: "Aytos" });
    const donor = await mkDonor(id, {
      donorYear: 2012,
      vin: "WVWZZZ1KZ9W123456",
      vinDerivedNotes: "STAFF ONLY NOTE",
      mileageKm: 214000,
      registrationCountry: "DE",
      engine: "2.0 TDI",
      engineCode: "CFFB",
      fuel: "Diesel",
      transmission: "manual",
      bodyStyle: "Estate",
      drivetrain: "FWD",
      scrapReason: "Flood damage in the 2023 storms\nWater reached the dashboard",
    });
    await mkListing(donor, id, "published");
    await db.donorVehiclePhoto.create({ data: { donorVehicleId: donor, url: "https://x/car.jpg", caption: "front", displayOrder: 0 } });

    const page = await getDonorVehiclePage(db, donor);

    expect(page).toMatchObject({
      id: donor,
      makeName: S("Mk"),
      modelGroupName: S("Model"),
      generationLabel: S("Gen"),
      year: 2012,
      maskedVin: "WVW••••••••••3456",
      mileageKm: 214000,
      registrationCountry: "DE",
      engine: "2.0 TDI",
      engineCode: "CFFB",
      fuel: "Diesel",
      transmission: "manual",
      bodyStyle: "Estate",
      drivetrain: "FWD",
      scrapReason: "Flood damage in the 2023 storms\nWater reached the dashboard",
      photos: [{ url: "https://x/car.jpg", caption: "front" }],
      seller: { id, name: S("dv-card"), avatarUrl: "https://x/a.jpg", city: "Aytos" },
    });
    expect(JSON.stringify(page)).not.toContain("STAFF ONLY NOTE");
    expect(JSON.stringify(page)).not.toContain("WVWZZZ1KZ9W123456");
  });

  it("has no page for an unknown car, a car with nothing visible, or a seller who is not available", async () => {
    expect(await getDonorVehiclePage(db, "nope")).toBeNull();

    const active = await mkSeller("dv-none");
    const empty = await mkDonor(active);
    await mkListing(empty, active, "draft");
    await mkListing(empty, active, "cancelled");
    expect(await getDonorVehiclePage(db, empty)).toBeNull();

    for (const login of ["none", "banned"] as const) {
      const id = await mkSeller(`dv-unavail-${login}`, { login });
      const donor = await mkDonor(id);
      await mkListing(donor, id, "published");
      expect(await getDonorVehiclePage(db, donor)).toBeNull();
    }
  });
});
