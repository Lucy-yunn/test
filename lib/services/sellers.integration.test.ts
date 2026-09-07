import { describe, it, expect, afterAll } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db } from "../db";
import {
  createSeller,
  updateSeller,
  provisionSellerLogin,
  setSellerLoginEnabled,
  unlinkSellerLogin,
  resetUserPassword,
} from "./sellers";
import { signUpBuyer } from "./accounts";
import { ConflictError, InvariantError, NotFoundError } from "../dal/errors";

const TAG = `sel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const em = (s: string) => `${s}-${TAG}@example.test`;
const userIds: string[] = [];
const sellerIds: string[] = [];

async function newSeller(over: Partial<Parameters<typeof createSeller>[1]> = {}) {
  const { id } = await createSeller(db, {
    displayName: `Seller ${TAG}`,
    contactName: "Contact",
    contactEmail: em("contact"),
    locationCity: "Sofia",
    ...over,
  });
  sellerIds.push(id);
  return id;
}

afterAll(async () => {
  await db.account.deleteMany({ where: { userId: { in: userIds } } });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.buyer.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.user.deleteMany({ where: { email: { contains: TAG } } });
  await db.$disconnect();
});

describe("createSeller / updateSeller", () => {
  it("creates a profile with no User and defaults country to BG", async () => {
    const id = await newSeller({ contactEmail: em("noCountry") });
    const s = await db.seller.findUnique({ where: { id } });
    expect(s?.userId).toBeNull();
    expect(s?.locationCountry).toBe("BG");

    await updateSeller(db, id, { displayName: "Renamed Yard" });
    expect((await db.seller.findUnique({ where: { id } }))?.displayName).toBe("Renamed Yard");
  });
});

describe("provisionSellerLogin", () => {
  it("creates a seller User + working credential and links it", async () => {
    const id = await newSeller({ contactEmail: em("prov") });
    const { initialPassword } = await provisionSellerLogin(db, {
      sellerId: id,
      loginEmail: em("prov-login"),
    });

    const s = await db.seller.findUnique({ where: { id }, select: { userId: true } });
    expect(s?.userId).toBeTruthy();
    userIds.push(s!.userId!);

    const user = await db.user.findUnique({ where: { id: s!.userId! } });
    const account = await db.account.findFirst({ where: { userId: s!.userId! } });
    expect(user?.role).toBe("seller");
    expect(await verifyPassword({ hash: account!.password!, password: initialPassword })).toBe(true);
  });

  it("rejects an email already held by ANY user (one-role rule)", async () => {
    const taken = em("taken");
    const buyer = await signUpBuyer(db, { email: taken, password: "buyer-pw-123", name: "B" });
    userIds.push(buyer.userId);

    const id = await newSeller({ contactEmail: em("collide") });
    await expect(
      provisionSellerLogin(db, { sellerId: id, loginEmail: taken }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await db.seller.findUnique({ where: { id } }))?.userId).toBeNull();
  });

  it("refuses to provision a second login", async () => {
    const id = await newSeller({ contactEmail: em("twice") });
    const r = await provisionSellerLogin(db, { sellerId: id, loginEmail: em("twice-a") });
    const s = await db.seller.findUnique({ where: { id }, select: { userId: true } });
    userIds.push(s!.userId!);
    void r;
    await expect(
      provisionSellerLogin(db, { sellerId: id, loginEmail: em("twice-b") }),
    ).rejects.toBeInstanceOf(InvariantError);
  });
});

describe("login management", () => {
  it("disable/enable toggles the ban; unlink clears userId and bans", async () => {
    const id = await newSeller({ contactEmail: em("mng") });
    await provisionSellerLogin(db, { sellerId: id, loginEmail: em("mng-login") });
    const userId = (await db.seller.findUnique({ where: { id }, select: { userId: true } }))!.userId!;
    userIds.push(userId);

    await setSellerLoginEnabled(db, id, false);
    expect((await db.user.findUnique({ where: { id: userId } }))?.banned).toBe(true);
    await setSellerLoginEnabled(db, id, true);
    expect((await db.user.findUnique({ where: { id: userId } }))?.banned).toBe(false);

    await unlinkSellerLogin(db, id);
    expect((await db.seller.findUnique({ where: { id } }))?.userId).toBeNull();
    expect((await db.user.findUnique({ where: { id: userId } }))?.banned).toBe(true);
  });

  it("resetUserPassword issues a new working password", async () => {
    const id = await newSeller({ contactEmail: em("rst") });
    await provisionSellerLogin(db, { sellerId: id, loginEmail: em("rst-login") });
    const userId = (await db.seller.findUnique({ where: { id }, select: { userId: true } }))!.userId!;
    userIds.push(userId);

    const { password } = await resetUserPassword(db, userId);
    const account = await db.account.findFirst({ where: { userId } });
    expect(await verifyPassword({ hash: account!.password!, password })).toBe(true);
  });

  it("throws NotFoundError managing a login on a seller that has none", async () => {
    const id = await newSeller({ contactEmail: em("nologin") });
    await expect(setSellerLoginEnabled(db, id, false)).rejects.toBeInstanceOf(InvariantError);
    await expect(resetUserPassword(db, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
