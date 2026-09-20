# ADR-0011 — Public seller profile and donor-vehicle page; seller contact is login-gated

- **Status:** accepted
- **Date:** 2026-09-19
- **Source:** founders' v1 scope revision · full rules in [`docs/seller-profile.md`](../seller-profile.md)
- **Reverses:** the "no dedicated donor-vehicle page" cut in [`donor-vehicle-parts.md`](../donor-vehicle-parts.md) §1 and §8 ([#23](https://github.com/Lucy-yunn/carparts/issues/23)); the "buyer sees only display name and city" rule in [`auth-and-permissions.md`](../auth-and-permissions.md) §7 and [`order-model.md`](../order-model.md) §11

## Context

Trust is the main obstacle for a used-parts marketplace in a small market. Buyers want to know who the seller is, what else they have, and where each part really came from. The original design deliberately kept seller identity and donor-vehicle pages out of v1.

## Decision

- Every Seller has a **public profile** with tabs for their cars, their parts and their reviews.
- Every DonorVehicle has a **public page** that acts as the car's "ID card": full details, the free-text reason it was scrapped, and every part taken from it.
- **Sold parts are shown, greyed and last, only on the donor-vehicle page.** Elsewhere sold listings stay hidden.
- The seller's **phone number is shown only to signed-in users**. Anonymous visitors see a single button that leads to sign-in or registration.

## Consequences

**Positive**
- A car's history and a seller's track record become visible, which is the platform's trust mechanism.
- Requiring sign-in for the phone number blocks scraping and builds the buyer list.

**Negative / trade-offs**
- The buyer-facing surface roughly doubles: two new page types, plus saved sellers and reviews.
- Listing sold parts on the donor page slightly weakens the rule that only actionable stock is visible.
- A seller's phone number is personal data shown to every registered user. Acceptable because it is a business number the seller agreed to publish at onboarding.
