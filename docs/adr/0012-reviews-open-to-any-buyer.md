# ADR-0012 — Seller reviews are open to any signed-in buyer, labelled by purchase

- **Status:** accepted
- **Date:** 2026-09-19
- **Source:** founders' v1 scope revision · full rules in [`docs/reviews.md`](../reviews.md)
- **Reverses:** "no ratings, reviews or seller scores" in [`seller-center.md`](../seller-center.md) §8

## Context

The usual safeguard is to let only buyers with a completed order review a seller. But the founders expect very few completed orders in the pilot, and completion is set by the seller, who could delay it to avoid a review. A purchase-only rule would leave every seller stuck at "no reviews".

## Decision

- **Any signed-in buyer may review any seller.** No purchase is required and there is no per-buyer limit.
- Each review carries a **context label**: the purchased part's name when it is linked to a completed order, otherwise **"No purchase"**.
- **All non-hidden reviews count** toward the average and total. A seller with fewer than 3 reviews shows **"New seller"** instead of a rating.
- The seller may **reply once**. Staff may **hide** a review with a recorded reason. Sellers and staff cannot write reviews.

## Consequences

**Positive**
- Ratings become meaningful early, and the label lets readers judge each one.
- Very little machinery: no eligibility engine and no moderation queue beyond a hide action.

**Negative / trade-offs**
- Trivially gameable: friends and rivals can post reviews. The founders accepted this for a small pilot of personally known sellers; the only control is staff hiding.
- Purchase-verified and unverified reviews are averaged together.
- If abuse appears, the first fix is to weight or exclude "No purchase" reviews from the average, which needs no schema change.
