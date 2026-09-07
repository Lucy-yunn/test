import type { Actor } from "./actor";
import { ForbiddenError } from "./errors";

/**
 * Pure ownership scoping for the service layer (docs/auth-and-permissions.md §10,
 * docs/order-model.md §11). Role *actions* are gated by the session guards;
 * these gate *data access*:
 *  - staff see everything;
 *  - a seller sees only their own `Seller`'s data;
 *  - a buyer sees only their own `Buyer`'s data.
 *
 * Callers resolve the row's owning id first, then call these.
 */
export function assertOwnsSellerData(actor: Actor, sellerId: string): void {
  if (actor.role === "staff") return;
  if (actor.role === "seller" && actor.sellerId === sellerId) return;
  throw new ForbiddenError("Not your seller data");
}

export function assertOwnsBuyerData(actor: Actor, buyerId: string): void {
  if (actor.role === "staff") return;
  if (actor.role === "buyer" && actor.buyerId === buyerId) return;
  throw new ForbiddenError("Not your buyer data");
}
