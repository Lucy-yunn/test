import type { ListingStatus } from "@prisma/client";

/**
 * Who holds a reserved listing, from the viewer's side: the viewing buyer, another buyer, or
 * not applicable (the viewer is the seller, or the listing is not reserved). Node-safe.
 */
export type ReservedBy = "viewer" | "someone_else" | "none";

/**
 * The badge in a thread's pinned listing header (docs/messaging-model.md section 3.3), or null
 * while the listing is simply on sale.
 */
export function threadListingBadge(status: ListingStatus, reservedBy: ReservedBy): string | null {
  switch (status) {
    case "published":
      return null;
    case "reserved":
      return reservedBy === "viewer"
        ? "You've reserved this item"
        : reservedBy === "someone_else"
          ? "Reserved by another buyer"
          : "Reserved";
    case "sold":
      return "Sold";
    default:
      return "No longer listed";
  }
}
