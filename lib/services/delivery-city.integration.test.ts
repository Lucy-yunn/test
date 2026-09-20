import { describe, it, expect, afterAll } from "vitest";
import { db } from "../db";
import type { Actor } from "../dal/actor";
import { chooseDeliveryCity, resolveDeliveryLocation, MAX_CITY_LENGTH } from "./delivery-city";

const TAG = `city-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const userIds: string[] = [];

async function buyer(label: string): Promise<Actor> {
  const user = await db.user.create({ data: { name: `B ${label}`, email: `${label}-${TAG}@example.test`, role: "buyer" } });
  userIds.push(user.id);
  const b = await db.buyer.create({ data: { userId: user.id } });
  return { userId: user.id, role: "buyer", buyerId: b.id, sellerId: null, messagingBlocked: false };
}

const staff: Actor = { userId: "u-staff", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

/** What a page passes in: nothing chosen, nothing detected, no fallback. */
const NOTHING = { cookieCity: null, ipCityHeader: null, fallbackCity: null };

afterAll(async () => {
  await db.buyer.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("resolveDeliveryLocation: a city the visitor chose always wins over a guess", () => {
  it("prefers the signed-in buyer's saved city", async () => {
    const me = await buyer("prefers-saved");
    await chooseDeliveryCity(db, me, "Varna");

    const location = await resolveDeliveryLocation(db, {
      actor: me,
      cookieCity: "Ruse",
      ipCityHeader: "Sofia",
      fallbackCity: "Aytos",
    });

    expect(location).toEqual({ city: "Varna", source: "chosen" });
  });

  it("then the city chosen in this browser", async () => {
    const location = await resolveDeliveryLocation(db, {
      actor: null,
      cookieCity: "Ruse",
      ipCityHeader: "Sofia",
      fallbackCity: "Aytos",
    });
    expect(location).toEqual({ city: "Ruse", source: "chosen" });
  });

  it("uses the browser's city for a buyer who has not saved one", async () => {
    const me = await buyer("cookie-only");
    expect(await resolveDeliveryLocation(db, { ...NOTHING, actor: me, cookieCity: "Ruse" })).toEqual({
      city: "Ruse",
      source: "chosen",
    });
  });

  it("then the city guessed from the IP address, marked as a guess", async () => {
    expect(await resolveDeliveryLocation(db, { ...NOTHING, actor: null, ipCityHeader: "Sofia" })).toEqual({
      city: "Sofia",
      source: "detected",
    });
  });

  it("decodes the URL-encoded value Vercel sends", async () => {
    const detect = async (ipCityHeader: string) =>
      (await resolveDeliveryLocation(db, { ...NOTHING, actor: null, ipCityHeader })).city;
    expect(await detect("Stara%20Zagora")).toBe("Stara Zagora");
    expect(await detect("Ruse%2C%20BG")).toBe("Ruse, BG");
  });

  it("falls back to the given city when the header is missing, blank or malformed", async () => {
    for (const ipCityHeader of [null, undefined, "", "   ", "%E0%A4%A"]) {
      const location = await resolveDeliveryLocation(db, {
        actor: null,
        cookieCity: null,
        ipCityHeader,
        fallbackCity: "Aytos",
      });
      expect(location).toEqual({ city: "Aytos", source: "detected" });
    }
  });

  it("has no city when nothing is known", async () => {
    expect(await resolveDeliveryLocation(db, { ...NOTHING, actor: null })).toEqual({ city: null, source: null });
  });

  it("ignores blank values", async () => {
    const location = await resolveDeliveryLocation(db, {
      actor: null,
      cookieCity: "  ",
      ipCityHeader: "Sofia",
      fallbackCity: null,
    });
    expect(location.source).toBe("detected");
  });

  it("ignores a saved city of a blank string left in the database", async () => {
    const me = await buyer("blank-saved");
    await db.buyer.update({ where: { id: me.buyerId! }, data: { deliveryCity: "   " } });
    expect(await resolveDeliveryLocation(db, { ...NOTHING, actor: me, cookieCity: "Ruse" })).toEqual({
      city: "Ruse",
      source: "chosen",
    });
  });

  it("does not look up a saved city for anonymous visitors or non-buyer roles", async () => {
    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: staff, cookieCity: "Ruse" })).city).toBe("Ruse");
    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: null })).city).toBeNull();
  });
});

describe("chooseDeliveryCity: what the header control stores", () => {
  it("saves a buyer's city trimmed and returns the value for the browser cookie", async () => {
    const me = await buyer("save");

    expect(await chooseDeliveryCity(db, me, "  Stara Zagora ")).toBe("Stara Zagora");

    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: me })).city).toBe("Stara Zagora");
  });

  it("clears a buyer's saved city with a blank value, and returns null so the cookie is removed", async () => {
    const me = await buyer("clear");
    await chooseDeliveryCity(db, me, "Varna");

    expect(await chooseDeliveryCity(db, me, "   ")).toBeNull();

    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: me })).city).toBeNull();
  });

  it("keeps the city per buyer", async () => {
    const a = await buyer("a");
    const b = await buyer("b");
    await chooseDeliveryCity(db, a, "Plovdiv");
    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: b })).city).toBeNull();
  });

  it("cuts an absurdly long value to the limit rather than refusing it", async () => {
    const me = await buyer("long");

    const stored = await chooseDeliveryCity(db, me, "x".repeat(MAX_CITY_LENGTH + 20));

    expect(stored).toBe("x".repeat(MAX_CITY_LENGTH));
    expect((await resolveDeliveryLocation(db, { ...NOTHING, actor: me })).city).toBe("x".repeat(MAX_CITY_LENGTH));
  });

  it("stores nothing in the database for an anonymous visitor or a non-buyer, but still returns the cookie value", async () => {
    expect(await chooseDeliveryCity(db, null, " Sofia ")).toBe("Sofia");
    expect(await chooseDeliveryCity(db, staff, "Sofia")).toBe("Sofia");
    expect(await chooseDeliveryCity(db, null, "")).toBeNull();
  });
});
