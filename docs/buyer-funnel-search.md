# Buyer funnel search & Browse UX — v1

Resolves [Buyer funnel search UX (#9)](https://github.com/Lucy-yunn/test/issues/9)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

**Amended by [#21](https://github.com/Lucy-yunn/test/issues/21)** (2026-09): the vehicle
catalogue is `VehicleGeneration`-grain, buyer discovery is **provenance-only**, and the
`Fitment` entity / confirmed-fit badges / Fitment ∪ Provenance union are **removed from v1**.
The former `docs/fitment-and-compatibility-search.md` is deleted; its surviving content (the
provenance match query and partial-funnel widening) is folded into §3 below. This document is
now the **single owner** of how a buyer moves from their vehicle to a list of Listings.

Entity fields live in [`docs/domain-model.md`](./domain-model.md). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md).

This document owns: **how the buyer moves through `Make → Model → Generation → part
category`**, **the provenance match that produces results**, **what the Browse results page
shows and how it ranks**, **empty states**, and **how the buyer refines after results**.

Prototypes (throwaway, on branch `prototype/buyer-funnel-search`) predate #21 — their
"Engine variant" spec-card step and fit badges are superseded by this document. Founder mocks
in `UI/`.

---

## 1. The funnel is the only way in

v1 has **no keyword search, no OEM part-number lookup, no free category browse**. The buyer
reaches Listings through one funnel: **`Make → Model → Generation → part category`**. There
is **no year step, no engine step, and no body-style step** — the Generation carries the
production-year range and spans every engine and body of that platform.

Entry point: the **homepage funnel bar** (prototype homepage take **A** — faithful to the
founder's original `UI/` mock; the mock's slot-3 label "Engine variant" is replaced by
"Generation" per #21).

- A **horizontal 4-slot bar** (`Make · Model · Generation · Part` + a gold **Search**
  button) sits in the hero, under the headline *"Find the part you need, without the wait."*
- Tapping a slot drops an options panel below the bar. The Generation panel is the spec
  cards (§1.2); the Part panel is the grouped category list.
- Search is **never a dead control**: until Make + Model are set it opens the next empty
  step; once they are set it navigates to **Browse** (`/browse?...`).
- Below the hero, in order: the **Most Viewed** carousel (**v2**, not first release), then
  **"What's in stock right now"** — category tiles with live in-stock counts (the v1
  discovery surface).
- **No "How IVO works" explainer block.**

### 1.1 The four steps

| Step | Control | Notes |
|---|---|---|
| **Make** | list of makes | from the hand-built catalogue |
| **Model** | list of the make's **Model Groups** | one entry per grouped line — `A4, S4`; `80, 90`; `100` (#21) |
| **Generation** *(optional)* | **spec cards**, one per `VehicleGeneration` | see §1.2 |
| **Part category** | one list, **grouped by Group heading** | **no separate Group step** (#3) |

The **Group layer is a heading / breadcrumb segment only** — never its own screen or click.
~13 Groups over the coarse leaf Categories; a Group screen would be a click that teaches
nothing.

### 1.2 Picking a Generation — spec cards

The buyer picks a generation / platform, not an engine. Each `VehicleGeneration` is a
**spec card** showing, as content (not ornament):

`<label>` · **production-year range** · chassis codes · body styles the generation covers

e.g. **A4 S4 B8 8K** · 2008–2015 · saloon, avant.

Plus an explicit **"I'm not sure / show all years — search every `<Model>` generation"**
button.

- The Generation step is **optional**. Skipping it (or choosing "not sure") runs the
  **partial funnel**: the search widens to *every `VehicleGeneration` of that Model Group*
  (§3.2).
- Engine, fuel and gearbox are **not** part of the funnel. If the buyer knows their engine
  they narrow to it **after results**, via the Engine / Fuel / Gearbox facets (§4) — these
  filter on the *donor vehicle's* recorded engine, and are never a compatibility assertion.

---

## 2. Browse — the results page

Realizes the founder's mock (`UI/Browse/`). Reached only from the funnel's Search button.

**Layout**, top to bottom:

1. **Breadcrumb** — `Home › <Make> › <Model> › <Group> › <Category>`. Group appears here as
   a segment (it is a label, not a step).
2. **H1** — `Used <Make> <Model> <Category>`, plus `· <Generation label>` when the buyer
   picked one.
3. **Two columns**: left **filter rail** (§4), right **results**.
4. Results header: **`N parts found`** + **Clear filters** + **removable filter chips** (the
   car chip is locked; facet chips have an `×`).
5. **Toolbar**: numbered **pagination** + **`Sort by`**.
6. **Result rows** (§3).
7. Bottom pagination.

Pagination is **numbered pages** (~12 per page), not infinite scroll.

### 2.1 A result row

Horizontal row: photo (with photo count) · body · price + favourite.

Body, in order:

- **Title** — the Listing title.
- **`Taken from: <Make> <Model> <Generation label>`** — the donor vehicle, shown in brand
  purple on **every** row. This is the provenance line; it is always present.
- **Donor detail line** — the donor vehicle's `engine` · `engineCode` · `fuel` ·
  `transmission` where recorded (e.g. *2.0 TDI · CAGA · diesel · manual*). This is how the
  buyer checks the part against their own car — there is no fit badge.
- Meta: condition chip · **part number** · `Seller: <name>, <city>` (with the seller
  country flag/marker) · listed-age.
- Per-fault **defect bullet list** when the Listing has `ListingDefect` rows.

**No fit badge.** A one-line note sits under the results header:
*"Parts are matched by the car they were removed from. Same-generation parts are not
guaranteed to fit — check the part number and the engine details before you buy."*

---

## 3. The provenance match & ranking

*(Folds in the surviving content of the deleted `fitment-and-compatibility-search.md`.)*

### 3.1 The match

The funnel resolves the buyer to a `VehicleGeneration` **X** and a leaf `Category` **C**. The
result set is every **`Listing`** where:

- `Listing.status ∈ {published, reserved}`, **and**
- `Listing.Part.categoryId == C`, **and**
- `Listing.donorVehicle.generationId == X` — the physical part was removed from a car of that
  generation.

That is the whole match. There is **no `Fitment` path and no union** — a Part is found only
through the donor vehicle of its Listings. Consequences:

- A Part with no `PartNumber` is still found (via its Listing's donor generation) — the
  numberless-used-part case still works.
- The match is **provenance, not compatibility.** A same-generation part may still not fit
  the buyer's exact car (different engine, facelift, options). The buyer confirms with the
  part number and the donor detail line (§2.1); the footer policy (§6) states this.

### 3.2 Partial funnel

If the buyer stops at **Model** (no Generation chosen), the match widens:
`Listing.donorVehicle.generationId` is **any `VehicleGeneration` of that Model Group**. This
backs the funnel's "stopping partway shows a list to continue from" (#18/#25). The buyer then
narrows with the **Generation** facet (§4).

### 3.3 Ranking

No fit signal means no fit-based ordering. **Default sort = "Newest first"** (by
`Listing.publishedAt`).

`Sort by` options: **Newest first** (default) · Price: low → high · Price: high → low ·
Best condition first.

---

## 4. Refining after results

Left **filter rail**, accordion sections, each option showing a **live count** that reflects
the other active filters (real faceted search):

| Facet | Source | Behaviour |
|---|---|---|
| **Categories** | leaf Categories present in the result set | switch / narrow the leaf without re-running the funnel |
| **Generation** | the Model Group's `VehicleGeneration`s | the **partial-funnel narrowing tool** — pick your generation to drop the other generations' parts |
| **Engine** | `donorVehicle.engine` / `donorVehicle.engineCode` | provenance narrowing only |
| **Fuel type** | `donorVehicle.fuel` | provenance narrowing only |
| **Gearbox type** | `donorVehicle.transmission` | **now a real filter** — donor transmission is recorded (#21) |
| **Quality** | `Listing.condition` | New / Used–good / Needs repair |
| **Price** | `Listing.priceEur` | range — stubbed in the prototype |

The Engine / Fuel / Gearbox facets filter on the **donor vehicle's** recorded values and are
**never compatibility assertions**. A Listing whose donor value is **unknown (null)** is
**not** shown as a match for a selected value on that facet.

Active filters also render as **removable chips** above the results, with a **Clear filters**
reset. The car (Make/Model[/Generation]) chip is locked — clearing it means starting a new
funnel.

---

## 5. Empty results

When the funnel + filters resolve to zero Listings, show a panel (not a bare "0 results"):

- Headline: `No <category> for this car yet`.
- **Primary action: "Notify me when one is listed"** (fits the small-catalogue reality).
- **"Search all `<Model>` generations"** — one tap, clears the Generation facet (widen the
  partial funnel).
- **"Clear the other filters"** — when engine / fuel / gearbox / quality / price filters are
  the cause.

No dead ends.

---

## 6. Shell chrome (both homepage & Browse)

- **Language**: a **dropdown `<select>`** in the top bar (not a two-way toggle). **English is
  the only live locale in v1**; `Български / Nederlands / Deutsch / Français / Română` are
  listed as placeholders for later EU markets (upholds the standing "language switch present
  from day one" preference). Selecting a non-English option shows a "not translated yet"
  notice and reverts.
- **Delivery-to** location indicator (`Bulgaria, Aytos` in the demo).
- Header utilities: messages, **favourites** (buyer favourites are in scope), cart, log in.
- **Footer** — a full commerce footer on both pages: **Buying** / **Help** / **Legal**
  columns; an operator + VAT line; a **payment-methods** row; and a policy block that states,
  in buyer-facing language:
  - **Condition & returns** — parts sold as described with photos + defect list; cancel any
    time before dispatch; once shipped, no cancellation and **no returns/refunds process in
    v1**; EU statutory consumer rights unaffected. (Mirrors #10 / #8.)
  - **How matching works** — results show parts by the vehicle they were **removed from**.
    IVO does **not** verify that a part fits any other vehicle. A part from the same
    generation is **not guaranteed** to fit your car — always check the **part number** and
    the listed **engine / gearbox details** against your own vehicle before buying. IVO is a
    marketplace and the **seller is the contracting party** per order.
  - **Demo-build disclaimer** — no real orders, payments, or personal data.
  - Legal copy is **placeholder** and needs a real pass before launch.

---

## 7. Out of scope for v1 (confirmed here)

- Keyword search, OEM part-number lookup, free category browse (funnel is the only entry).
- **Platform-verified cross-vehicle compatibility / a `Fitment` entity / confirmed-fit
  badges** — removed by #21; a possible future feature, not v1.
- **Most Viewed** / any popularity or recommendation surface — deferred to v2.
- Real transmission-of-the-*part* data — the Gearbox facet filters on the *donor* car only.
- Buyer-reported "this didn't fit my car" feedback loop — map fog, may never graduate.
- Full non-English translation content.
