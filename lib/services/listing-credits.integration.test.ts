import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { InvariantError } from "../dal/errors";
import { publishListing, setListingStatusByStaff } from "./listings";
import { adjustCredits, getCreditSummary, NO_CREDITS_MESSAGE } from "./credits";

/**
 * Publishing costs one credit (docs/seller-credits.md section 3): charged each time a listing
 * moves into `published` from `draft` or `cancelled`, in the same transaction as the status
 * change, and refused when the seller has none.
 */
const TAG = `lc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

let generationId: string;
let categoryId: string;
let staffId: string;
const sellerIds: string[] = [];
const userIds: string[] = [];
const donorIds: string[] = [];
const listingIds: string[] = [];
const partIds: string[] = [];

/** A seller with an active login and `credits` credits. */
async function mkSeller(label: string, credits: number) {
  const user = await db.user.create({ data: { name: S(label), email: `${label}-${TAG}@example.test`, role: "seller" } });
  userIds.push(user.id);
  const seller = await db.seller.create({
    data: { displayName: S(label), contactName: "C", contactEmail: `${label}-${TAG}@x.test`, locationCity: "Sofia", userId: user.id },
  });
  sellerIds.push(seller.id);
  if (credits > 0) await adjustCredits(db, { sellerId: seller.id, amount: credits, note: "test credits", createdBy: staffId });
  return seller.id;
}

/** A listing that passes every checklist item, in the given status. */
async function mkListing(sellerId: string, status: "draft" | "cancelled" | "published" = "draft", ready = true) {
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
      priceEur: ready ? "10.00" : "0.00",
      condition: "used_good",
      status,
      publishedAt: status === "published" ? new Date() : null,
      noVisiblePartNumber: true,
      photos: { create: { url: "https://x/p.jpg", displayOrder: 0 } },
    },
  });
  listingIds.push(listing.id);
  return listing.id;
}

const statusOf = async (id: string) => (await db.listing.findUniqueOrThrow({ where: { id } })).status;
const publishEntries = (sellerId: string) => db.creditLedgerEntry.findMany({ where: { sellerId, kind: "publish" } });

beforeAll(async () => {
  const make = await db.vehicleMake.create({ data: { name: S("Mk"), slug: S("mk") } });
  const mg = await db.vehicleModelGroup.create({ data: { name: S("Model"), slug: S("model"), makeId: make.id } });
  generationId = (await db.vehicleGeneration.create({ data: { label: S("Gen"), slug: S("gen"), modelGroupId: mg.id } })).id;
  const group = await db.group.create({ data: { name: S("Grp"), slug: S("grp"), displayOrder: 940 } });
  categoryId = (await db.category.create({ data: { name: S("Cat"), slug: S("cat"), groupId: group.id, displayOrder: 1 } })).id;
  staffId = (await db.user.create({ data: { name: S("staff"), email: `staff-${TAG}@example.test`, role: "staff" } })).id;
  userIds.push(staffId);
});

afterAll(async () => {
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.listing.deleteMany({ where: { id: { in: listingIds } } });
  await db.part.deleteMany({ where: { id: { in: partIds } } });
  await db.donorVehicle.deleteMany({ where: { id: { in: donorIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.category.deleteMany({ where: { slug: S("cat") } });
  await db.group.deleteMany({ where: { slug: S("grp") } });
  await db.vehicleGeneration.deleteMany({ where: { slug: S("gen") } });
  await db.vehicleModelGroup.deleteMany({ where: { slug: S("model") } });
  await db.vehicleMake.deleteMany({ where: { slug: S("mk") } });
  await db.$disconnect();
});

describe("publishing a draft", () => {
  it("costs one credit, and the ledger says which listing and who published it", async () => {
    const sellerId = await mkSeller("pays", 3);
    const listingId = await mkListing(sellerId);

    await publishListing(db, listingId, staffId);

    expect(await statusOf(listingId)).toBe("published");
    const summary = await getCreditSummary(db, sellerId);
    expect(summary.balance).toBe(2);
    expect(summary.entries[0]).toMatchObject({ delta: -1, kind: "publish" });
    expect(await publishEntries(sellerId)).toEqual([
      expect.objectContaining({ listingId, delta: -1, createdBy: staffId }),
    ]);
  });

  it("is refused when the seller has no credits, and nothing changes", async () => {
    const sellerId = await mkSeller("broke", 0);
    const listingId = await mkListing(sellerId);

    const attempt = publishListing(db, listingId, staffId);

    await expect(attempt).rejects.toBeInstanceOf(InvariantError);
    await expect(attempt).rejects.toThrow(NO_CREDITS_MESSAGE);
    expect(await statusOf(listingId)).toBe("draft");
    expect(await getCreditSummary(db, sellerId)).toEqual({ balance: 0, entries: [] });
  });

  it("spends the last credit, then refuses the next one", async () => {
    const sellerId = await mkSeller("last", 1);
    const first = await mkListing(sellerId);
    const second = await mkListing(sellerId);

    await publishListing(db, first, staffId);
    await expect(publishListing(db, second, staffId)).rejects.toThrow(NO_CREDITS_MESSAGE);

    expect(await statusOf(first)).toBe("published");
    expect(await statusOf(second)).toBe("draft");
    expect((await getCreditSummary(db, sellerId)).balance).toBe(0);
  });

  it("is not charged when the checklist fails", async () => {
    const sellerId = await mkSeller("checklist", 2);
    const listingId = await mkListing(sellerId, "draft", false);

    await expect(publishListing(db, listingId, staffId)).rejects.toThrow(/checklist/i);

    expect(await statusOf(listingId)).toBe("draft");
    expect((await getCreditSummary(db, sellerId)).balance).toBe(2);
  });

  it("cannot spend the same credit twice when two publishes happen at once", async () => {
    const sellerId = await mkSeller("race", 1);
    const a = await mkListing(sellerId);
    const b = await mkListing(sellerId);

    const results = await Promise.allSettled([publishListing(db, a, staffId), publishListing(db, b, staffId)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(refused?.reason).toBeInstanceOf(InvariantError);
    expect(await publishEntries(sellerId)).toHaveLength(1);
    expect((await getCreditSummary(db, sellerId)).balance).toBe(0);
    const statuses = [await statusOf(a), await statusOf(b)].sort();
    expect(statuses).toEqual(["draft", "published"]);
  });
});

describe("putting a cancelled listing back on sale", () => {
  it("costs one credit again", async () => {
    const sellerId = await mkSeller("relist", 2);
    const listingId = await mkListing(sellerId, "cancelled");

    await setListingStatusByStaff(db, listingId, "published", staffId);

    expect(await statusOf(listingId)).toBe("published");
    expect((await getCreditSummary(db, sellerId)).balance).toBe(1);
    expect(await publishEntries(sellerId)).toEqual([expect.objectContaining({ listingId, createdBy: staffId })]);
  });

  it("is refused when the seller has no credits, and the listing stays cancelled", async () => {
    const sellerId = await mkSeller("relist-broke", 0);
    const listingId = await mkListing(sellerId, "cancelled");

    await expect(setListingStatusByStaff(db, listingId, "published", staffId)).rejects.toThrow(NO_CREDITS_MESSAGE);

    expect(await statusOf(listingId)).toBe("cancelled");
  });
});

describe("changes that are not a publish", () => {
  it("cancelling and archiving cost nothing and return nothing", async () => {
    const sellerId = await mkSeller("free", 2);
    const listingId = await mkListing(sellerId);
    await publishListing(db, listingId, staffId);
    expect((await getCreditSummary(db, sellerId)).balance).toBe(1);

    await setListingStatusByStaff(db, listingId, "cancelled", staffId);
    await setListingStatusByStaff(db, listingId, "archived", staffId);

    expect(await statusOf(listingId)).toBe("archived");
    expect((await getCreditSummary(db, sellerId)).balance).toBe(1);
    expect(await publishEntries(sellerId)).toHaveLength(1);
  });

  it("the balance always equals the sum of the ledger after a mix of changes", async () => {
    const sellerId = await mkSeller("mix", 4);
    const a = await mkListing(sellerId);
    const b = await mkListing(sellerId);
    await publishListing(db, a, staffId);
    await publishListing(db, b, staffId);
    await setListingStatusByStaff(db, a, "cancelled", staffId);
    await setListingStatusByStaff(db, a, "published", staffId);
    await adjustCredits(db, { sellerId, amount: -1, note: "fix", createdBy: staffId });

    const { balance, entries } = await getCreditSummary(db, sellerId);

    expect(balance).toBe(entries.reduce((sum, e) => sum + e.delta, 0));
    expect(balance).toBe(0);
  });
});
