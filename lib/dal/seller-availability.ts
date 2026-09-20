import type { Prisma, PrismaClient } from "@prisma/client";
import { InvariantError, NotFoundError } from "./errors";

/**
 * The one rule for whether a seller is *available* (docs/auth-and-permissions.md §4.4):
 * it has a linked login that staff have not disabled. Sellers operate their own orders
 * (ADR-0009), so only an available seller can publish, be reserved from, have a public
 * profile, be saved, or be linked to from a listing page.
 *
 * Everything that decides availability goes through here, so the answer cannot drift:
 *  - `SELLER_AVAILABILITY_SELECT` is what a query loads, so the deciding fields are
 *    fetched together with the rest of the row instead of in a second query;
 *  - `sellerIsAvailable` is the pure decision over what was loaded;
 *  - `isSellerAvailable` / `assertSellerAvailable` are for callers with only an id.
 */

/** The fields a query must select to decide availability. Spread it into a `select`. */
export const SELLER_AVAILABILITY_SELECT = {
  userId: true,
  user: { select: { banned: true } },
} satisfies Prisma.SellerSelect;

export interface SellerLoginState {
  userId: string | null;
  user: { banned: boolean } | null;
}

export const NO_ACTIVE_LOGIN_MESSAGE = "This seller has no active login";

export function sellerIsAvailable(seller: SellerLoginState): boolean {
  return seller.userId != null && !seller.user?.banned;
}

/** For a caller that has already loaded the seller with `SELLER_AVAILABILITY_SELECT`. */
export function assertSellerStateAvailable(seller: SellerLoginState): void {
  if (!sellerIsAvailable(seller)) throw new InvariantError(NO_ACTIVE_LOGIN_MESSAGE);
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function isSellerAvailable(db: Db, sellerId: string): Promise<boolean> {
  const seller = await db.seller.findUnique({
    where: { id: sellerId },
    select: SELLER_AVAILABILITY_SELECT,
  });
  if (!seller) throw new NotFoundError(`Seller ${sellerId} not found`);
  return sellerIsAvailable(seller);
}

export async function assertSellerAvailable(db: Db, sellerId: string): Promise<void> {
  if (!(await isSellerAvailable(db, sellerId))) throw new InvariantError(NO_ACTIVE_LOGIN_MESSAGE);
}
