import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

/**
 * Committed staff-account script (docs/auth-and-permissions.md §5): one named
 * `User(role=staff)` per founder, credentials from env vars, so every admin
 * action is attributable. No profile entity. No staff-management UI — a third
 * staff member is added by adding STAFF_3_* and re-running.
 *
 * Node-safe. Run: `npm run db:seed:staff`.
 */
export interface StaffSeed {
  email: string;
  name: string;
  password: string;
}

/** Reads STAFF_<n>_EMAIL / _NAME / _PASSWORD for n = 1, 2, 3, … until a gap. */
export function parseStaffFromEnv(env: Record<string, string | undefined>): StaffSeed[] {
  const out: StaffSeed[] = [];
  for (let n = 1; ; n++) {
    const email = env[`STAFF_${n}_EMAIL`]?.trim();
    const name = env[`STAFF_${n}_NAME`]?.trim();
    const password = env[`STAFF_${n}_PASSWORD`];
    if (!email && !name && !password) break;
    if (!email || !name || !password) {
      throw new Error(
        `STAFF_${n}_* is incomplete — set EMAIL, NAME and PASSWORD together.`,
      );
    }
    if (password.length < 8) {
      throw new Error(`STAFF_${n}_PASSWORD must be at least 8 characters.`);
    }
    out.push({ email: email.toLowerCase(), name, password });
  }
  return out;
}

/** Idempotent: upserts each staff `User` + its credential account by email. */
export async function seedStaff(
  db: PrismaClient,
  staff: StaffSeed[],
): Promise<{ email: string; created: boolean }[]> {
  const results: { email: string; created: boolean }[] = [];

  for (const s of staff) {
    const existing = await db.user.findUnique({
      where: { email: s.email },
      select: { id: true, role: true },
    });

    if (existing && existing.role !== "staff") {
      throw new Error(
        `${s.email} already exists as role "${existing.role}" — refusing to convert it to staff.`,
      );
    }

    const passwordHash = await hashPassword(s.password);

    if (existing) {
      await db.$transaction([
        db.user.update({ where: { id: existing.id }, data: { name: s.name } }),
        db.account.updateMany({
          where: { userId: existing.id, providerId: "credential" },
          data: { password: passwordHash },
        }),
      ]);
      results.push({ email: s.email, created: false });
    } else {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: s.email, name: s.name, role: "staff", emailVerified: true },
        });
        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      });
      results.push({ email: s.email, created: true });
    }
  }

  return results;
}
