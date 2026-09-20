/**
 * The buyer-facing policy copy (docs/buyer-funnel-search.md section 6, docs/order-model.md). Node-safe.
 *
 * One place, so the footer and the policy pages cannot say different things. The wording is a
 * placeholder for the legal text: it needs a real pass before any launch.
 */

export const OPERATOR_LINE = "IVO — operated by the founders. VAT number: placeholder.";

export const PAYMENT_METHODS_LINE =
  "Payment method: cash on delivery, paid to the seller after you inspect the part at the courier.";

export const HOW_MATCHING_WORKS: readonly string[] = [
  "Results show parts by the vehicle they were removed from.",
  "IVO does not verify that a part fits any other vehicle. A part from the same generation is not guaranteed to fit your car.",
  "Always check the part number and the listed engine and gearbox details against your own vehicle before buying.",
  "IVO is a marketplace, and the seller is the contracting party for each order.",
];

export const CONDITION_AND_RETURNS: readonly string[] = [
  "Parts are sold as described, with photos and a defect list.",
  "You pay the seller in cash after you inspect the part at the courier, and you may decline it there. The price shown excludes the courier fee, which you pay to the courier.",
  "You can cancel any time before handover.",
  "There is no returns or refunds process in v1. Your EU statutory consumer rights are unaffected.",
];

export const DEMO_DISCLAIMER = "Demo build — no real orders, payments, or personal data.";

export const LEGAL_PLACEHOLDER_NOTE = "Placeholder legal copy. It needs a real review before launch.";
