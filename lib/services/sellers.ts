import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { ConflictError, InvariantError, NotFoundError } from "../dal/errors";
import { generateInitialPassword } from "./credentials";

/**
 * Seller onboarding & login provisioning — node-safe (docs/auth-and-permissions.md
 * §4, docs/spec/admin-tool.md §2). Two phases: the `Seller` profile always;
 * a login (`User{role:seller}` linked 1:1) optionally, later or never.
 */

const CREDENTIAL = "credential";
const normEmail = (e: string) => e.trim().toLowerCase();

export interface SellerLocation {
  locationName?: string | null;
  locationLine1?: string | null;
  locationCity: string;
  locationPostcode?: string | null;
  locationCountry?: string;
}

export interface CreateSellerInput extends SellerLocation {
  displayName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
}

/** Phase 1 — create the profile. No `User`. */
export async function createSeller(
  db: PrismaClient,
  input: CreateSellerInput,
): Promise<{ id: string }> {
  const seller = await db.seller.create({
    data: {
      displayName: input.displayName.trim(),
      contactName: input.contactName.trim(),
      contactEmail: normEmail(input.contactEmail),
      contactPhone: input.contactPhone?.trim() || null,
      locationName: input.locationName?.trim() || null,
      locationLine1: input.locationLine1?.trim() || null,
      locationCity: input.locationCity.trim(),
      locationPostcode: input.locationPostcode?.trim() || null,
      locationCountry: input.locationCountry?.trim() || "BG",
    },
    select: { id: true },
  });
  return seller;
}

export async function updateSeller(
  db: PrismaClient,
  sellerId: string,
  patch: Partial<CreateSellerInput>,
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.displayName !== undefined) data.displayName = patch.displayName.trim();
  if (patch.contactName !== undefined) data.contactName = patch.contactName.trim();
  if (patch.contactEmail !== undefined) data.contactEmail = normEmail(patch.contactEmail);
  if (patch.contactPhone !== undefined) data.contactPhone = patch.contactPhone?.trim() || null;
  if (patch.locationName !== undefined) data.locationName = patch.locationName?.trim() || null;
  if (patch.locationLine1 !== undefined) data.locationLine1 = patch.locationLine1?.trim() || null;
  if (patch.locationCity !== undefined) data.locationCity = patch.locationCity.trim();
  if (patch.locationPostcode !== undefined) data.locationPostcode = patch.locationPostcode?.trim() || null;
  if (patch.locationCountry !== undefined) data.locationCountry = patch.locationCountry?.trim() || "BG";

  await db.seller.update({ where: { id: sellerId }, data });
}

/**
 * Phase 2 — provision a login. Rejects (ConflictError) if the email belongs to
 * ANY existing `User` — the one-role rule (ADR-0004). Returns the initial
 * password to show once.
 */
export async function provisionSellerLogin(
  db: PrismaClient,
  args: { sellerId: string; loginEmail: string },
): Promise<{ initialPassword: string }> {
  const email = normEmail(args.loginEmail);

  const seller = await db.seller.findUnique({
    where: { id: args.sellerId },
    select: { id: true, userId: true, contactName: true, displayName: true },
  });
  if (!seller) throw new NotFoundError("Seller not found");
  if (seller.userId) throw new InvariantError("This seller already has a login");

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("This email already has an account");
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: seller.contactName || seller.displayName,
          role: "seller",
          emailVerified: true,
        },
      });
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: CREDENTIAL,
          password: passwordHash,
        },
      });
      await tx.seller.update({ where: { id: seller.id }, data: { userId: user.id } });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("This email already has an account");
    throw err;
  }

  return { initialPassword };
}

/** Disable / enable a seller's login (Better Auth ban toggle). */
export async function setSellerLoginEnabled(
  db: PrismaClient,
  sellerId: string,
  enabled: boolean,
): Promise<void> {
  const userId = await requireLinkedUser(db, sellerId);
  await db.user.update({
    where: { id: userId },
    data: {
      banned: !enabled,
      banReason: enabled ? null : "Login disabled by staff",
      banExpires: null,
    },
  });
}

/** Unlink: clear `Seller.userId` AND disable the `User` (never a hard delete). */
export async function unlinkSellerLogin(
  db: PrismaClient,
  sellerId: string,
): Promise<void> {
  const userId = await requireLinkedUser(db, sellerId);
  await db.$transaction([
    db.seller.update({ where: { id: sellerId }, data: { userId: null } }),
    db.user.update({
      where: { id: userId },
      data: { banned: true, banReason: "Login unlinked by staff", banExpires: null },
    }),
  ]);
}

/** Reset any `User`'s password to a fresh random one (shown once). */
export async function resetUserPassword(
  db: PrismaClient,
  userId: string,
): Promise<{ password: string }> {
  const account = await db.account.findFirst({
    where: { userId, providerId: CREDENTIAL },
    select: { id: true },
  });
  if (!account) throw new NotFoundError("No password account for this user");

  const password = generateInitialPassword();
  await db.account.update({
    where: { id: account.id },
    data: { password: await hashPassword(password) },
  });
  return { password };
}

async function requireLinkedUser(db: PrismaClient, sellerId: string): Promise<string> {
  const seller = await db.seller.findUnique({
    where: { id: sellerId },
    select: { userId: true },
  });
  if (!seller) throw new NotFoundError("Seller not found");
  if (!seller.userId) throw new InvariantError("This seller has no login");
  return seller.userId;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
