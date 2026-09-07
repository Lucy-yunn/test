import type { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { ConflictError, ForbiddenError, NotFoundError } from "../dal/errors";

/**
 * Account operations — node-safe (takes a Prisma client; no `server-only`, no
 * Next). Server Actions do the session/redirect plumbing and call these.
 *
 * Password hashing uses `better-auth/crypto` directly — the same scheme Better
 * Auth's default email/password verifier uses, so an account written here signs
 * in through `auth.api.signInEmail` normally (see prisma/seed/seed.ts).
 *
 * Sources: docs/auth-and-permissions.md §3 (buyer registration, §3.3 settings).
 */

type Db = PrismaClient | Prisma.TransactionClient;

const CREDENTIAL = "credential";
const normEmail = (e: string) => e.trim().toLowerCase();

export interface SignUpBuyerInput {
  email: string;
  password: string;
  name: string;
}

/**
 * Creates `User(role=buyer)` + its credential `Account` + the `Buyer` profile in
 * ONE transaction (docs/auth-and-permissions.md §3.2 — no Better Auth after-hook;
 * a failed `Buyer` insert must not leave an orphan `User`).
 */
export async function signUpBuyer(
  db: PrismaClient,
  input: SignUpBuyerInput,
): Promise<{ userId: string; buyerId: string }> {
  const email = normEmail(input.email);

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ConflictError("This email already has an account");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: input.name.trim(), role: "buyer", emailVerified: true },
      });
      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: CREDENTIAL,
          password: passwordHash,
        },
      });
      const buyer = await tx.buyer.create({ data: { userId: user.id } });
      return { userId: user.id, buyerId: buyer.id };
    });
  } catch (err) {
    // Lost a race on the unique email constraint.
    if (isUniqueViolation(err)) {
      throw new ConflictError("This email already has an account");
    }
    throw err;
  }
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

/** Swap the credential password after verifying the current one (§3.3). */
export async function changePassword(
  db: Db,
  input: ChangePasswordInput,
): Promise<void> {
  const account = await db.account.findFirst({
    where: { userId: input.userId, providerId: CREDENTIAL },
    select: { id: true, password: true },
  });
  if (!account?.password) {
    throw new NotFoundError("No password account for this user");
  }

  const ok = await verifyPassword({
    hash: account.password,
    password: input.currentPassword,
  });
  if (!ok) throw new ForbiddenError("Current password is incorrect");

  await db.account.update({
    where: { id: account.id },
    data: { password: await hashPassword(input.newPassword) },
  });
}

export interface BuyerAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postcode: string;
  country: string;
}

export interface UpdateBuyerProfileInput {
  buyerId: string;
  name?: string;
  address?: BuyerAddress;
}

/** Buyer self-service: `name` (on `User`) + the saved delivery address (§3.3). */
export async function updateBuyerProfile(
  db: PrismaClient,
  input: UpdateBuyerProfileInput,
): Promise<void> {
  const buyer = await db.buyer.findUnique({
    where: { id: input.buyerId },
    select: { userId: true },
  });
  if (!buyer) throw new NotFoundError("Buyer not found");

  await db.$transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.user.update({
        where: { id: buyer.userId },
        data: { name: input.name.trim() },
      });
    }
    if (input.address) {
      await tx.buyer.update({
        where: { id: input.buyerId },
        data: {
          recipientName: input.address.recipientName,
          phone: input.address.phone,
          addressLine1: input.address.addressLine1,
          addressLine2: input.address.addressLine2 ?? null,
          city: input.address.city,
          postcode: input.address.postcode,
          country: input.address.country,
        },
      });
    }
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
