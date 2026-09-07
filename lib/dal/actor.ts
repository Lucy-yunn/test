/**
 * The authenticated caller, resolved once per request by lib/dal/session.ts and
 * passed to every service function. Node-safe (no session plumbing here).
 *
 * `sellerId` is set only for a `seller` whose `Seller.userId` is linked (a
 * provisioned login) — the permission matrix's "Seller WITH a login".
 */
export type Role = "buyer" | "seller" | "staff";

export interface Actor {
  userId: string;
  role: Role;
  buyerId: string | null;
  sellerId: string | null;
  messagingBlocked: boolean;
}

export const isBuyer = (a: Actor): boolean =>
  a.role === "buyer" && a.buyerId !== null;
export const isSeller = (a: Actor): boolean =>
  a.role === "seller" && a.sellerId !== null;
export const isStaff = (a: Actor): boolean => a.role === "staff";
