import { InvariantError } from "./errors";

/**
 * Node-safe state machines. These encode WHICH transitions are legal — not who
 * may trigger them (that's a role/actor check in the service function) and not
 * the side effects (order↔listing coupling, cancellation approval) which the
 * order/cancellation build steps own.
 *
 * Sources: docs/domain-model.md (Listing / Order lifecycle), docs/order-model.md,
 * docs/domain-model.md Part.partStatus.
 */

type OrderStatus = "placed" | "confirmed" | "shipped" | "delivered" | "cancelled";
type ListingStatus =
  | "draft"
  | "published"
  | "reserved"
  | "sold"
  | "cancelled"
  | "archived";
type PartStatus = "provisional" | "confirmed";

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"], // cancel only pre-ship
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const LISTING_TRANSITIONS: Record<
  ListingStatus,
  readonly ListingStatus[]
> = {
  draft: ["published"], // staff, passes the publish checklist
  published: ["reserved", "cancelled", "archived"],
  reserved: ["sold", "published"], // sold on order delivered; published on pre-ship cancel
  sold: [], // terminal
  cancelled: ["published", "archived"],
  archived: [], // terminal
};

export const PART_STATUS_TRANSITIONS: Record<PartStatus, readonly PartStatus[]> = {
  provisional: ["confirmed"],
  confirmed: [], // staff-verified; never goes back
};

export function canTransition<S extends string>(
  machine: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return (machine[from] ?? []).includes(to);
}

export function assertTransition<S extends string>(
  machine: Record<S, readonly S[]>,
  from: S,
  to: S,
  label: string,
): void {
  if (!canTransition(machine, from, to)) {
    throw new InvariantError(
      `${label}: illegal status transition ${from} → ${to}`,
    );
  }
}
