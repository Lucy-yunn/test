import { describe, it, expect, afterAll } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import { db } from "../../lib/db";
import { seedStaff } from "./staff";

const TAG = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const one = `lucy-${TAG}@ivo.test`;
const two = `ivo-${TAG}@ivo.test`;
const emails = [one, two];

afterAll(async () => {
  await db.account.deleteMany({ where: { user: { email: { in: emails } } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });
  await db.$disconnect();
});

describe("seedStaff", () => {
  it("creates staff Users with a working password", async () => {
    const r = await seedStaff(db, [
      { email: one, name: "Lucy", password: "founder-pw-one" },
      { email: two, name: "Ivo", password: "founder-pw-two" },
    ]);
    expect(r).toEqual([
      { email: one, created: true },
      { email: two, created: true },
    ]);

    const user = await db.user.findUnique({ where: { email: one } });
    const account = await db.account.findFirst({ where: { userId: user!.id } });
    expect(user?.role).toBe("staff");
    expect(await verifyPassword({ hash: account!.password!, password: "founder-pw-one" })).toBe(true);
  });

  it("is idempotent — re-running updates name/password, creates no duplicates", async () => {
    const r = await seedStaff(db, [
      { email: one, name: "Lucy Renamed", password: "rotated-pw" },
      { email: two, name: "Ivo", password: "founder-pw-two" },
    ]);
    expect(r.every((x) => x.created === false)).toBe(true);

    expect(await db.user.count({ where: { email: { in: emails } } })).toBe(2);
    const user = await db.user.findUnique({ where: { email: one } });
    const account = await db.account.findFirst({ where: { userId: user!.id } });
    expect(user?.name).toBe("Lucy Renamed");
    expect(await verifyPassword({ hash: account!.password!, password: "rotated-pw" })).toBe(true);
  });

  it("refuses to convert a non-staff account to staff", async () => {
    const buyer = await db.user.create({
      data: { email: two.replace("ivo-", "buyer-"), name: "B", role: "buyer" },
    });
    emails.push(buyer.email);
    await expect(
      seedStaff(db, [{ email: buyer.email, name: "B", password: "12345678" }]),
    ).rejects.toThrow(/refusing to convert/);
  });
});
