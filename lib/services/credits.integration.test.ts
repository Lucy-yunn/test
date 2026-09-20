import { describe, it, expect, afterAll } from "vitest";
import { db } from "../db";
import { InvariantError, NotFoundError } from "../dal/errors";
import {
  createBundle,
  updateBundle,
  listBundles,
  topUp,
  adjustCredits,
  getCreditSummary,
  NO_CREDITS_MESSAGE,
} from "./credits";

/** Seller credits (docs/seller-credits.md, ADR-0010): bundles, top-ups, adjustments and the ledger. */
const TAG = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const S = (n: string) => `${TAG}-${n}`;

const sellerIds: string[] = [];
const bundleIds: string[] = [];
let staffId: string;

async function staff() {
  if (!staffId) {
    staffId = (await db.user.create({ data: { name: S("staff"), email: `staff-${TAG}@example.test`, role: "staff" } })).id;
  }
  return staffId;
}

async function mkSeller(label: string) {
  const seller = await db.seller.create({
    data: { displayName: S(label), contactName: "C", contactEmail: `${label}-${TAG}@x.test`, locationCity: "Sofia" },
  });
  sellerIds.push(seller.id);
  return seller.id;
}

async function mkBundle(credits = 25, extra: Partial<Parameters<typeof createBundle>[1]> = {}) {
  const { id } = await createBundle(db, { name: S(`bundle-${credits}`), credits, priceEur: "40.00", ...extra });
  bundleIds.push(id);
  return id;
}

const pause = () => new Promise((r) => setTimeout(r, 5));

afterAll(async () => {
  await db.creditLedgerEntry.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.creditBundle.deleteMany({ where: { id: { in: bundleIds } } });
  await db.user.deleteMany({ where: { email: `staff-${TAG}@example.test` } });
  await db.$disconnect();
});

describe("credit bundles", () => {
  it("are created with a name, a number of credits and a price, and listed in display order", async () => {
    const second = await mkBundle(100, { displayOrder: 902, priceEur: "70.00" });
    const first = await mkBundle(25, { displayOrder: 901 });

    const mine = (await listBundles(db)).filter((b) => bundleIds.includes(b.id));

    expect(mine.map((b) => b.id)).toEqual([first, second]);
    expect(mine[1]).toMatchObject({ credits: 100, priceEur: "70", isActive: true, displayOrder: 902 });
  });

  it("can be edited, and an inactive one drops out of the active list but stays in the full list", async () => {
    const id = await mkBundle(50);

    await updateBundle(db, id, { name: S("renamed"), credits: 60, priceEur: "55.50", isActive: false });

    expect((await listBundles(db, { activeOnly: true })).some((b) => b.id === id)).toBe(false);
    const all = await listBundles(db);
    expect(all.find((b) => b.id === id)).toMatchObject({ name: S("renamed"), credits: 60, priceEur: "55.5", isActive: false });
  });

  it("refuse a blank name, a credit count that is not a positive whole number, and a negative price", async () => {
    await expect(createBundle(db, { name: "  ", credits: 10, priceEur: "5" })).rejects.toBeInstanceOf(InvariantError);
    for (const credits of [0, -5, 2.5]) {
      await expect(createBundle(db, { name: S("bad"), credits, priceEur: "5" })).rejects.toBeInstanceOf(InvariantError);
    }
    await expect(createBundle(db, { name: S("bad"), credits: 10, priceEur: "-1" })).rejects.toBeInstanceOf(InvariantError);
    await expect(createBundle(db, { name: S("bad"), credits: 10, priceEur: "abc" })).rejects.toBeInstanceOf(InvariantError);
  });

  it("cannot be edited when unknown", async () => {
    await expect(updateBundle(db, "nope", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("topping up and adjusting", () => {
  it("a new seller has no credits and an empty ledger", async () => {
    const sellerId = await mkSeller("new");
    expect(await getCreditSummary(db, sellerId)).toEqual({ balance: 0, entries: [] });
  });

  it("adding a bundle writes a top-up for its credits, credited to the staff member", async () => {
    const sellerId = await mkSeller("topup");
    const bundleId = await mkBundle(25);

    await topUp(db, { sellerId, bundleId, createdBy: await staff() });

    const summary = await getCreditSummary(db, sellerId);
    expect(summary.balance).toBe(25);
    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0]).toMatchObject({ delta: 25, kind: "topup", bundleName: S("bundle-25"), note: null });
    expect(await db.creditLedgerEntry.findFirst({ where: { sellerId }, select: { createdBy: true } })).toEqual({
      createdBy: staffId,
    });
  });

  it("an inactive bundle cannot be used for a new top-up, and nothing is written", async () => {
    const sellerId = await mkSeller("inactive");
    const bundleId = await mkBundle(25, { isActive: false });

    await expect(topUp(db, { sellerId, bundleId, createdBy: await staff() })).rejects.toBeInstanceOf(InvariantError);

    expect(await getCreditSummary(db, sellerId)).toEqual({ balance: 0, entries: [] });
  });

  it("an existing entry is unaffected when its bundle is later switched off or repriced", async () => {
    const sellerId = await mkSeller("history");
    const bundleId = await mkBundle(25);
    await topUp(db, { sellerId, bundleId, createdBy: await staff() });

    await updateBundle(db, bundleId, { credits: 999, isActive: false });

    expect((await getCreditSummary(db, sellerId)).balance).toBe(25);
  });

  it("an unknown seller or bundle is refused", async () => {
    const sellerId = await mkSeller("unknown");
    const bundleId = await mkBundle(25);
    await expect(topUp(db, { sellerId: "nope", bundleId, createdBy: await staff() })).rejects.toBeInstanceOf(NotFoundError);
    await expect(topUp(db, { sellerId, bundleId: "nope", createdBy: await staff() })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("an adjustment writes a signed entry with its note", async () => {
    const sellerId = await mkSeller("adjust");
    await adjustCredits(db, { sellerId, amount: 10, note: "  goodwill  ", createdBy: await staff() });
    await pause();
    await adjustCredits(db, { sellerId, amount: -4, note: "listed twice by mistake", createdBy: await staff() });

    const summary = await getCreditSummary(db, sellerId);

    expect(summary.balance).toBe(6);
    expect(summary.entries.map((e) => [e.delta, e.kind, e.note])).toEqual([
      [-4, "adjustment", "listed twice by mistake"],
      [10, "adjustment", "goodwill"],
    ]);
  });

  it("an adjustment needs a note and a non-zero amount", async () => {
    const sellerId = await mkSeller("adjust-bad");
    for (const note of ["", "   "]) {
      await expect(adjustCredits(db, { sellerId, amount: 5, note, createdBy: await staff() })).rejects.toBeInstanceOf(InvariantError);
    }
    for (const amount of [0, 1.5, Number.NaN]) {
      await expect(adjustCredits(db, { sellerId, amount, note: "x", createdBy: await staff() })).rejects.toBeInstanceOf(InvariantError);
    }
    expect(await getCreditSummary(db, sellerId)).toEqual({ balance: 0, entries: [] });
  });

  it("an adjustment cannot take the balance below zero", async () => {
    const sellerId = await mkSeller("adjust-floor");
    await adjustCredits(db, { sellerId, amount: 3, note: "start", createdBy: await staff() });

    await expect(adjustCredits(db, { sellerId, amount: -4, note: "too much", createdBy: await staff() })).rejects.toBeInstanceOf(InvariantError);

    expect((await getCreditSummary(db, sellerId)).balance).toBe(3);
  });
});

describe("the ledger", () => {
  it("lists newest first, and the balance always equals the sum of the entries", async () => {
    const sellerId = await mkSeller("ledger");
    const bundleId = await mkBundle(25);
    await topUp(db, { sellerId, bundleId, createdBy: await staff() });
    await pause();
    await adjustCredits(db, { sellerId, amount: -7, note: "correction", createdBy: await staff() });
    await pause();
    await topUp(db, { sellerId, bundleId, createdBy: await staff() });

    const { balance, entries } = await getCreditSummary(db, sellerId);

    expect(entries.map((e) => e.delta)).toEqual([25, -7, 25]);
    expect(balance).toBe(entries.reduce((sum, e) => sum + e.delta, 0));
    expect(balance).toBe(43);
  });

  it("keeps each seller's credits apart", async () => {
    const a = await mkSeller("apart-a");
    const b = await mkSeller("apart-b");
    await topUp(db, { sellerId: a, bundleId: await mkBundle(25), createdBy: await staff() });

    expect((await getCreditSummary(db, b)).balance).toBe(0);
  });

  it("returns only the newest entries when asked for a limit, with the full balance", async () => {
    const sellerId = await mkSeller("limit");
    for (let i = 1; i <= 3; i++) {
      await adjustCredits(db, { sellerId, amount: i, note: `n${i}`, createdBy: await staff() });
      await pause();
    }

    const summary = await getCreditSummary(db, sellerId, { limit: 2 });

    expect(summary.balance).toBe(6);
    expect(summary.entries.map((e) => e.delta)).toEqual([3, 2]);
  });

  it("says what the refusal to publish looks like", () => {
    expect(NO_CREDITS_MESSAGE).toBe("This seller has no credits.");
  });
});
