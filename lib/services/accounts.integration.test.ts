import { describe, it, expect, afterAll } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db } from "../db";
import {
  signUpBuyer,
  changePassword,
  updateBuyerProfile,
} from "./accounts";
import { ConflictError, ForbiddenError, NotFoundError } from "../dal/errors";

const TAG = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const email = (s: string) => `${s}-${TAG}@example.test`;
const created: string[] = []; // userIds to clean up

afterAll(async () => {
  await db.buyer.deleteMany({ where: { userId: { in: created } } });
  await db.account.deleteMany({ where: { userId: { in: created } } });
  await db.session.deleteMany({ where: { userId: { in: created } } });
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("signUpBuyer", () => {
  it("creates a User(role=buyer) + credential Account + Buyer atomically", async () => {
    const { userId, buyerId } = await signUpBuyer(db, {
      email: email("new"),
      password: "correct horse 8",
      name: "Ada Buyer",
    });
    created.push(userId);

    const user = await db.user.findUnique({ where: { id: userId } });
    const account = await db.account.findFirst({ where: { userId } });
    const buyer = await db.buyer.findUnique({ where: { id: buyerId } });

    expect(user?.role).toBe("buyer");
    expect(user?.name).toBe("Ada Buyer");
    expect(buyer?.userId).toBe(userId);
    expect(account?.providerId).toBe("credential");
    // password stored as a Better-Auth-compatible hash, not plaintext
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain("correct horse 8");
    expect(await verifyPassword({ hash: account!.password!, password: "correct horse 8" })).toBe(true);
  });

  it("lower-cases and trims the email", async () => {
    const { userId } = await signUpBuyer(db, {
      email: `  ${email("CASE").toUpperCase()} `,
      password: "correct horse 8",
      name: "Case Test",
    });
    created.push(userId);
    const user = await db.user.findUnique({ where: { id: userId } });
    expect(user?.email).toBe(email("case"));
  });

  it("rejects a duplicate email with ConflictError, no orphan User", async () => {
    const e = email("dup");
    const { userId } = await signUpBuyer(db, { email: e, password: "correct horse 8", name: "First" });
    created.push(userId);

    await expect(
      signUpBuyer(db, { email: e, password: "another one 9", name: "Second" }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(await db.user.count({ where: { email: e } })).toBe(1);
  });
});

describe("changePassword", () => {
  it("swaps the hash after verifying the current password", async () => {
    const { userId } = await signUpBuyer(db, {
      email: email("pw"),
      password: "old password 1",
      name: "PW Test",
    });
    created.push(userId);

    await changePassword(db, {
      userId,
      currentPassword: "old password 1",
      newPassword: "brand new pw 2",
    });

    const account = await db.account.findFirst({ where: { userId } });
    expect(await verifyPassword({ hash: account!.password!, password: "brand new pw 2" })).toBe(true);
    expect(await verifyPassword({ hash: account!.password!, password: "old password 1" })).toBe(false);
  });

  it("rejects a wrong current password with ForbiddenError", async () => {
    const { userId } = await signUpBuyer(db, {
      email: email("pw2"),
      password: "the real one 1",
      name: "PW2",
    });
    created.push(userId);

    await expect(
      changePassword(db, { userId, currentPassword: "guessing 9", newPassword: "whatever 2" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws NotFoundError when the user has no credential account", async () => {
    await expect(
      changePassword(db, { userId: "no-such-user", currentPassword: "x", newPassword: "y" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("updateBuyerProfile", () => {
  it("updates the User name and the Buyer delivery address", async () => {
    const { userId, buyerId } = await signUpBuyer(db, {
      email: email("prof"),
      password: "profile pw 12",
      name: "Before",
    });
    created.push(userId);

    await updateBuyerProfile(db, {
      buyerId,
      name: "After",
      address: {
        recipientName: "After Person",
        phone: "+359888123456",
        addressLine1: "1 Test St",
        city: "Sofia",
        postcode: "1000",
        country: "BG",
      },
    });

    const user = await db.user.findUnique({ where: { id: userId } });
    const buyer = await db.buyer.findUnique({ where: { id: buyerId } });
    expect(user?.name).toBe("After");
    expect(buyer?.city).toBe("Sofia");
    expect(buyer?.recipientName).toBe("After Person");
  });
});
