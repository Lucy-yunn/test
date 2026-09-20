import type { Actor } from "../dal/actor";
import { blankToNull } from "../text";

/**
 * The one rule for how much of a seller's contact a viewer may see (ADR-0011,
 * docs/seller-profile.md section 3): the phone number is for signed-in users only.
 *
 * Every page that shows a seller decides through `sellerContactFor`, and the number is
 * never put into what an anonymous visitor receives, so it cannot leak into the page,
 * its data or the network response. The result says which of three things to show.
 */
export type SellerContact =
  /** A signed-in viewer and the seller has a phone. */
  | { kind: "phone"; phone: string }
  /** A signed-in viewer, but the seller has no phone on file. */
  | { kind: "none" }
  /** An anonymous visitor: offer sign-in. Also used when the seller has no phone, so it reveals nothing. */
  | { kind: "sign_in" };

export function sellerContactFor(viewer: Actor | null, contactPhone: string | null | undefined): SellerContact {
  if (!viewer) return { kind: "sign_in" };
  const phone = blankToNull(contactPhone);
  return phone ? { kind: "phone", phone } : { kind: "none" };
}

/** A tap-to-call link: the dialler needs the number without spaces. */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}
