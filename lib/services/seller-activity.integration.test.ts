import { describe, it, expect, afterAll } from "vitest";
import { db } from "../db";
import { recordSellerActivity } from "./sellers";

const TAG = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const userIds: string[] = [];
const sellerIds: string[] = [];

const HOUR = 3_600_000;

async function sellerWithLogin(lastActiveAt: Date | null = null) {
  const user = await db.user.create({
    data: { name: `S ${TAG}`, email: `${sellerIds.length}-${TAG}@example.test`, role: "seller" },
  });
  userIds.push(user.id);
  const seller = await db.seller.create({
    data: {
      displayName: `S ${TAG} ${sellerIds.length}`,
      contactName: "S",
      contactEmail: `${TAG}@x.test`,
      locationCity: "Sofia",
      userId: user.id,
      lastActiveAt,
    },
  });
  sellerIds.push(seller.id);
  return { userId: user.id, sellerId: seller.id };
}

const lastActive = async (sellerId: string) =>
  (await db.seller.findUniqueOrThrow({ where: { id: sellerId }, select: { lastActiveAt: true } })).lastActiveAt;

afterAll(async () => {
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("recordSellerActivity — the seller's last-active date, written at most once a day", () => {
  it("sets the time the first time a seller is active", async () => {
    const { userId, sellerId } = await sellerWithLogin(null);
    const now = new Date("2026-09-20T10:00:00Z");

    await recordSellerActivity(db, userId, now);

    expect(await lastActive(sellerId)).toEqual(now);
  });

  it("does not write again within 24 hours", async () => {
    const first = new Date("2026-09-20T10:00:00Z");
    const { userId, sellerId } = await sellerWithLogin(first);

    await recordSellerActivity(db, userId, new Date(first.getTime() + 23 * HOUR));

    expect(await lastActive(sellerId)).toEqual(first);
  });

  it("writes again once 24 hours have passed", async () => {
    const first = new Date("2026-09-20T10:00:00Z");
    const { userId, sellerId } = await sellerWithLogin(first);
    const later = new Date(first.getTime() + 25 * HOUR);

    await recordSellerActivity(db, userId, later);

    expect(await lastActive(sellerId)).toEqual(later);
  });

  it("ignores a user who is not linked to a seller", async () => {
    const buyer = await db.user.create({ data: { name: `B ${TAG}`, email: `b-${TAG}@example.test`, role: "buyer" } });
    userIds.push(buyer.id);

    await expect(recordSellerActivity(db, buyer.id, new Date())).resolves.toBeUndefined();
  });
});
