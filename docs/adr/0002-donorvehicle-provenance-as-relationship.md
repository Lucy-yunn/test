# ADR-0002 — `DonorVehicle` is a first-class entity; Provenance is a relationship

- **Status:** accepted
- **Date:** 2026-09-05
- **Source:** [#2 Core domain model](https://github.com/Lucy-yunn/test/issues/2) · full model in [`docs/domain-model.md`](../domain-model.md)

## Context

The map's Q6 framed **Provenance** — the actual donor vehicle a physical part was removed from — as a set of fields **embedded on the `Listing`** (make, model, year, engine code, transmission, VIN, mileage, visible OEM part number).

Staff intake is **donor-first**: a dismantler hands over one car and staff list dozens of parts from it. With embedded fields, VIN / mileage / engine code / generation would be re-typed on every one of those Listings, with no structural link between parts that came off the same car.

## Decision

**Provenance is a relationship, not embedded data.**

- A **`DonorVehicle`** is a first-class entity: the physical car a Seller dismantled. It carries the vehicle identity once — `generationId` (required), `label`, and the nullable structured detail `vin` / `mileageKm` / `donorYear` / `engine` / `engineCode` / `fuel` / `transmission` / `bodyStyle` / `drivetrain` / `registrationCountry`.
- A **`Listing`** points at exactly one `DonorVehicle` (`Listing.donorVehicleId`, required); **many Listings share one `DonorVehicle`**.
- **Provenance is that `Listing → DonorVehicle` link.** Part-specific removal detail ("removed with mounting bracket") is a nullable `removalNotes` field on the `Listing`.
- Invariant (DAL-enforced): `Listing.sellerId == DonorVehicle.sellerId`.
- `DonorVehicle` has **no lifecycle status** — it is a data record, entered once by staff.

This also enables the buyer-facing **"More parts from the same car"** section ([#23](https://github.com/Lucy-yunn/test/issues/23), [`docs/donor-vehicle-parts.md`](../donor-vehicle-parts.md)) as a pure `donorVehicleId` query — no new model element.

## Consequences

**Positive**
- Donor data is typed once per car, not once per part.
- "Other parts from this car" is a natural query.
- VIN masking, the staff-only `vinDerivedNotes`, and the structured donor detail shown on the Listing all live in one place.
- Provenance stays cleanly separate from compatibility (there is no `Fitment` in v1 — [ADR-0003](./0003-provenance-first-generation-grain.md); before #21 the separation was between two entities, now it is simply "provenance is the only vehicle link").

**Negative / trade-offs**
- One extra entity and one extra join on every listing render (`Listing → DonorVehicle → VehicleGeneration`).
- Staff must create the `DonorVehicle` before its Listings — a deliberate intake ordering ([`docs/seller-intake.md`](../seller-intake.md) §7).

## Alternatives considered

- **Embedded provenance fields on `Listing`** (the map's Q6) — rejected: re-typing per part, no same-car link, VIN/mileage duplicated across dozens of rows.
- **A nullable `DonorVehicle`** (unknown-donor case) — rejected by [#8](https://github.com/Lucy-yunn/test/issues/8): `DonorVehicle.generationId` is **required**; staff extend the hand-built catalogue during intake rather than leaving a donor unidentified.
