import { describe, it, expect, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { ForbiddenError, InvariantError } from "../dal/errors";
import { setDeliveryCity, getSavedDeliveryCity } from "./delivery-city";

const TAG = `city-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const userIds: string[] = [];

async function buyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: `B ${label}`, email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const b = await db.buyer.create({ data: { userId: user.id } });
  return { userId: user.id, role: "buyer", buyerId: b.id, sellerId: null, messagingBlocked: false };
}

afterAll(async () => {
  await db.buyer.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("a buyer's chosen delivery city", () => {
  it("is saved trimmed and read back", async () => {
    const me = await buyer("save");
    expect(await getSavedDeliveryCity(db, me)).toBeNull();

    await setDeliveryCity(db, me, "  Stara Zagora ");

    expect(await getSavedDeliveryCity(db, me)).toBe("Stara Zagora");
  });

  it("is cleared by a blank value", async () => {
    const me = await buyer("clear");
    await setDeliveryCity(db, me, "Varna");

    await setDeliveryCity(db, me, "   ");

    expect(await getSavedDeliveryCity(db, me)).toBeNull();
  });

  it("is kept per buyer", async () => {
    const a = await buyer("a");
    const b = await buyer("b");
    await setDeliveryCity(db, a, "Plovdiv");
    expect(await getSavedDeliveryCity(db, b)).toBeNull();
  });

  it("refuses an absurdly long value", async () => {
    const me = await buyer("long");
    await expect(setDeliveryCity(db, me, "x".repeat(81))).rejects.toBeInstanceOf(InvariantError);
  });

  it("is for buyer accounts only; anonymous and other roles simply have none saved", async () => {
    const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };
    await expect(setDeliveryCity(db, staff, "Sofia")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await getSavedDeliveryCity(db, staff)).toBeNull();
    expect(await getSavedDeliveryCity(db, null)).toBeNull();
  });
});
