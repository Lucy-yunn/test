# ADR-0007 — Staff-entry intake; no `SellerSubmission` entity

- **Status:** accepted
- **Date:** 2026-09-06
- **Source:** [#14 Seller inventory data-intake mechanism](https://github.com/Lucy-yunn/test/issues/14) · full spec in [`docs/seller-intake.md`](../seller-intake.md)

## Context

v1 listing entry is **staff-entry** (Q10): the founders create every `Listing` on the seller's behalf; there is no self-serve seller listing UI. Sellers still have to get their inventory *to* staff. The founder wants sellers to self-enter eventually, once volume grows.

The tempting design is a **`SellerSubmission` entity** — sellers (or staff on their behalf) fill a structured draft in the app, which staff then review and "convert" into `DonorVehicle` + `Listing` rows. That is essentially the self-serve machinery, built early.

## Decision

**Intake is out-of-band. Staff transcribe. There is no `SellerSubmission` entity and no in-app submission/convert flow in v1.**

- **One channel: the seller intake sheet** — a spreadsheet workbook (a `Vehicles` tab, a `Parts` tab, hidden dropdown-backed reference tabs for Makes / Models / Generations / Categories), handed to the seller, filled in, and returned with a photo folder. Returned workbooks and raw photos live in a plain shared drive, one folder per batch.
- **The seller fills everything** — Make / Model / Generation, leaf Category, visible codes, condition, every defect, photos, price (and optional donor engine/fuel/gearbox detail). **Staff review-only**: verify, never re-classify / re-price / rewrite. The seller's condition and defect text reach buyers as written; the seller's price is copied **unchanged** into `priceEur`.
- **Escape hatches** — `— NOT LISTED —` for a vehicle not yet in the catalogue, `Other` for a category — so an incomplete pilot catalogue never blocks a seller; staff extend the catalogue during transcription.
- **Traceability** comes from `Listing.createdBy`, `DonorVehicle.sellerId`, and `DonorVehicle.notes` — not a submission record.
- **Photos:** only the curated set staff attach enters Vercel Blob (downscaled on ingest); raw dumps are never migrated — so blob cost scales with **published listings**, not submissions.

**Two forward-compatibility hedges** (the only concessions to the future self-serve model):
1. the sheet's column set **is** the schema a future seller-facing form would collect;
2. `Listing.status = draft` + the publish checklist **already is** the approval gate — a future self-serve UI needs only permission to create `draft` Listings and `DonorVehicle` rows. **The build must not assume only staff create a draft.**

## Consequences

**Positive**
- No submission entity, no convert-flow, no review-queue UI to build for a handful of high-trust sellers and a seeded demo.
- Staff review happens *while transcribing* — one combined pass per part (publish checklist + honesty check + part work).
- Blob storage stays proportional to real inventory.

**Negative / trade-offs**
- Staff re-key every field a seller already typed into the sheet — real manual work, acceptable at pilot volume, and the trigger to build self-serve is exactly when that work gets heavy.
- The sheet is a medium-flexible artifact, not an enforced pipeline; malformed returns are handled by staff taking the data another way.

## Alternatives considered

- **A `SellerSubmission` table + staff "convert to listings" action** — rejected: it is the deferred self-serve machinery under another name.
- **A guided web form now** (buyer-style) — rejected: that *is* self-serve seller listing, explicitly out of scope for v1.
