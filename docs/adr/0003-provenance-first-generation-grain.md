# ADR-0003 — Provenance-first: `VehicleGeneration`-grain catalogue, no `Fitment` in v1

- **Status:** accepted
- **Date:** 2026-09-07
- **Source:** [#21 Vehicle-catalogue grain & the buyer-facing label](https://github.com/Lucy-yunn/test/issues/21) · reverses [#7](https://github.com/Lucy-yunn/test/issues/7); amends [#2](https://github.com/Lucy-yunn/test/issues/2) / [#4](https://github.com/Lucy-yunn/test/issues/4) / [#8](https://github.com/Lucy-yunn/test/issues/8) / [#9](https://github.com/Lucy-yunn/test/issues/9)
- **Buyer search:** [`docs/buyer-funnel-search.md`](../buyer-funnel-search.md) §3

## Context

The map originally (Q6, then [#2](https://github.com/Lucy-yunn/test/issues/2) / [#4](https://github.com/Lucy-yunn/test/issues/4) / [#7](https://github.com/Lucy-yunn/test/issues/7)) specified:

- an **engine-grain** vehicle catalogue leaf (`Modification` = a specific engine + engine code + body + power),
- a **`Fitment`** entity: staff-verified `Part ↔ Modification` compatibility assertions,
- buyer search as a **union** of the Fitment path and the Provenance path, with `✓ Confirmed fit` / `From a matching car` result badges.

While assembling this, two problems surfaced. (1) The founder's own UI mocks and the [#4](https://github.com/Lucy-yunn/test/issues/4) research both used **generation-grain** vehicle identity (`A4 S4 B5 8D (1994–1999)`), not engine-grain. (2) Maintaining a `Fitment` database means a two-person team researching, asserting and maintaining which other vehicles every part fits — ~1000 hand-verified catalogue rows and a compatibility assertion on every intake.

## Decision

**v1 is provenance-first. There is no platform-verified cross-vehicle compatibility.**

1. **Catalogue grain = `VehicleGeneration`.** The catalogue is `VehicleMake → VehicleModelGroup → VehicleGeneration`. A `VehicleGeneration` is a generation / platform + production-date range (`chassisCodes[]`, `productionStart/End`); it **spans every engine, fuel, gearbox and body** of that platform. Facelifts may be split by date range. Engine-grain `Modification` is gone.
2. **`VehicleModelGroup`** is the middle level — it groups closely-related model designations (`A4, S4`; `80, 90`). Its buyer-facing label is simply **"Model"**; there is **no additional buyer-facing "Model Group" level**. The buyer-facing hierarchy is **Make → Model → Generation → Category**.
3. **No `Fitment` entity.** No staff fitment workflow, no `verifiedBy`/`Fitment.note`, no confirmed-fit badges, no search union.
4. **Buyer discovery is the provenance match only:** a `Listing` surfaces for a buyer's chosen `VehicleGeneration` when `Listing.donorVehicle.generationId` matches (widened to any Generation of the Model when the buyer skips the Generation step). Default sort: newest first.
5. **Engine detail is per-car, on `DonorVehicle`** (`engine` / `engineCode` / `fuel` / `transmission` / `bodyStyle` / `drivetrain`), shown on every Listing and offered as optional **Engine / Fuel / Gearbox facets** on Browse. These narrow by the *donor* car's attributes; they are **never** compatibility assertions, and a null donor value never matches a selected filter.
6. **The buyer is told, explicitly**, that same-generation provenance is not a fit guarantee — a standing note on Browse and a footer "How matching works" block — and to check the **part number** and the shown **engine / gearbox details** before buying.

The catalogue now grows from **`DonorVehicle` intake only** (the [#7](https://github.com/Lucy-yunn/test/issues/7) fitment-entry growth path is gone).

## Consequences

**Positive**
- The hand-built catalogue drops to ~150 rows and is maintainable by two people.
- No compatibility assertion on intake; staff transcribe donor + part + price and publish.
- The result query is a single index (`Part.categoryId` + `donorVehicle.generationId`).
- The marketplace makes **no compatibility claim it cannot stand behind** — provenance is honest evidence, verified by the buyer against the part number.

**Negative / trade-offs**
- A part that genuinely fits many platforms is only discoverable via the one platform it was pulled from — a buyer with a different (compatible) car will not see it. Accepted for v1; a compatibility layer is a possible future effort (map *Out of scope*).
- Engine-specific parts (alternators, ECUs) rely on the buyer matching the shown engine code — more buyer effort than a `✓ Confirmed fit` badge would have given.
- Reverses a closed ticket ([#7](https://github.com/Lucy-yunn/test/issues/7)) and amends four others; `docs/fitment-and-compatibility-search.md` was deleted.

## Alternatives considered

- **The [#4](https://github.com/Lucy-yunn/test/issues/4)/[#7](https://github.com/Lucy-yunn/test/issues/7) design** (engine-grain catalogue + staff-verified `Fitment` + search union + badges) — rejected: too much ongoing curation for a two-person team; the founder's mocks never asked for it.
- **Generation-grain catalogue + structured `Fitment` constraints + a "conditional fit" badge** (explored mid-#21) — rejected by the founder: still a compatibility database to maintain.
