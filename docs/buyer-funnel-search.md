# Buyer funnel search & Browse UX — v1

Resolves [Buyer funnel search UX (#9)](https://github.com/Lucy-yunn/test/issues/9)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

The compatibility rules this UX renders (the Fitment ∪ Provenance union, the badge
vocabulary, partial-funnel widening) are owned by
[`docs/fitment-and-compatibility-search.md`](./fitment-and-compatibility-search.md). Entity
fields live in [`docs/domain-model.md`](./domain-model.md). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md).

This document owns: **how the buyer moves through `Make → Model → Modification → part
category`**, **what the Browse results page shows and how it ranks**, **empty states**, and
**how the buyer refines after results**.

Prototypes (throwaway, on branch `prototype/buyer-funnel-search`):
[`docs/prototypes/buyer-homepage.html`](./prototypes/buyer-homepage.html) ·
[`docs/prototypes/buyer-browse.html`](./prototypes/buyer-browse.html). Founder mocks in
`UI/`.

---

## 1. The funnel is the only way in

v1 has **no keyword search, no OEM part-number lookup, no free category browse**. The buyer
reaches Listings through one funnel: **`Make → Model → Modification → part category`**. There
is **no year step and no body-style step** (locked in #4) — the Modification carries the
year range.

Entry point: the **homepage funnel card** (prototype homepage take **C**).

- A compact vertical funnel card sits in the hero, beside the trust panel ("Why buyers
  trust IVO").
- The **Search button lives in the card header** — visible on landing, before any scroll.
- Search is **never a dead control**: until Make + Model are set it opens the next empty
  step; once they are set it navigates to **Browse** (`/browse?...`).
- Below the fold: category tiles with live in-stock counts (discovery). **Most Viewed** is
  **v2**, not first release.

### 1.1 The four steps

| Step | Control | Notes |
|---|---|---|
| **Make** | list of makes | from the hand-built catalogue |
| **Model** | list of the make's models | |
| **Modification** *(optional)* | **spec cards**, one per Modification | see §1.2 |
| **Part category** | one list, **grouped by Group heading** | **no separate Group step** (#3) |

The **Group layer is a heading / breadcrumb segment only** — never its own screen or click.
~13 Groups over the coarse leaf Categories; a Group screen would be a click that teaches
nothing.

### 1.2 Picking a Modification with no year — spec cards

A bare dropdown of engine codes is the one thing a non-expert buyer cannot do. Each
Modification is a **spec card** showing, as content (not ornament):

`<label>` · **year range** · fuel · power (hp) · body style · **engine code** · generation

Plus an explicit **"I'm not sure which engine — search all `<Model>` variants"** button.

- The Modification step is **optional**. Skipping it (or choosing "not sure") runs the
  **partial funnel**: the search widens to *every Modification of that Model*
  (`docs/fitment-and-compatibility-search.md` §3.2).
- The buyer then narrows to a confirmed-fit check **after results**, via the Engine-variant
  facet (§4).

---

## 2. Browse — the results page

Realizes the founder's mock (`UI/Browse/`). Reached only from the funnel's Search button.

**Layout**, top to bottom:

1. **Breadcrumb** — `Home › <Make> › <Model> › <Group> › <Category>`. Group appears here as
   a segment (it is a label, not a step).
2. **H1** — `Used <Make> <Model> <Category>`, plus `· <Modification label>` when the buyer
   picked one.
3. **Two columns**: left **filter rail** (§4), right **results**.
4. Results header: **`N parts found`** + **Clear filters** + **removable filter chips** (the
   car chip is locked; facet chips have an `×`).
5. **Toolbar**: numbered **pagination** + **`✓ Confirmed fit only`** toggle + **`Sort by`**.
6. **Result rows** (§3).
7. Bottom pagination.

Pagination is **numbered pages** (~12 per page), not infinite scroll.

### 2.1 A result row

Horizontal row: photo (with photo count) · body · price + favourite.

Body, in order:

- **Title** — the Listing title.
- **`Taken from: <Make> <Model> <label> (<engine code>)`** — the masked donor Modification,
  shown in brand purple on **every** row. This is the provenance line; it is always present.
- **Fit badge** — exactly one (§3.1).
- Meta: condition chip · part number · `Seller: <name>, <city>` · listed-age.
- Per-fault **defect bullet list** when the Listing has `ListingDefect` rows.

`Taken from:` (provenance) and the fit badge (fit signal) are **both shown** — they answer
different questions.

---

## 3. Ranking & the fit signal

### 3.1 Badge vocabulary (from #7)

Every result carries **one** badge:

- **`✓ Confirmed fit`** — the Part has a `Fitment` row for the buyer's Modification (or, in a
  partial-funnel search, for any Modification of the Model). A buyer-visible
  `Fitment.note` caveat ("M Sport only") shows next to it.
- **`From a matching car`** — provenance-only: the Part came off a `DonorVehicle` of a
  matching Modification but has **no** verified `Fitment`. Not fit-checked.

`whole-model:` `Fitment.note` values are **staff traceability, not buyer caveats** — they are
**suppressed from the buyer view**. *(Rule confirmed here; also to be reflected in
`docs/fitment-and-compatibility-search.md` §2.3.)*

### 3.2 Fit-signal presentation — prototype take **C**

One **flat list**. Each row badged. A prominent **`✓ Confirmed fit only`** toggle at the top
of the results lets the buyer collapse to just the verified parts. No forced two-section
split.

*(Tentative — revisit if buyer testing shows unverified rows are being missed; the
two-section layout, prototype take B, is the fallback.)*

### 3.3 Sort

**Default sort = "Best match"**: `✓ Confirmed fit` before `From a matching car`, then
**newest first** within each bucket.

`Sort by` options: **Best match** (default) · Newest first · Price: low → high · Price:
high → low · Best condition first. With any explicit sort chosen, `✓ Confirmed fit` rows are
still **held above** provenance-only rows (the fit distinction always wins over the sort key).

---

## 4. Refining after results

Left **filter rail**, accordion sections, each option showing a **live count** that reflects
the other active filters (real faceted search):

| Facet | Source | Behaviour |
|---|---|---|
| **Categories** | leaf Categories present in the result set | switch / narrow the leaf without re-running the funnel |
| **Engine variant** | the Model's Modifications | **the primary partial-funnel narrowing tool** — tick your engine to turn `From a matching car` rows into a real confirmed-fit check |
| **Fuel type** | `donorVehicle.modification.fuel` | |
| **Gearbox type** | *placeholder* — no transmission data on parts in v1; the slot is reserved | shown, filters nothing yet |
| **Quality** | `Listing.condition` | New / Used–good / Needs repair |
| **Price** | `Listing.priceEur` | range — stubbed in the prototype |

Active filters also render as **removable chips** above the results, with a **Clear filters**
reset. The car (Make/Model[/Modification]) chip is locked — clearing it means starting a new
funnel.

---

## 5. Empty results

When the funnel + filters resolve to zero Listings, show a panel (not a bare "0 results"):

- Headline: `No <category> for this car yet`.
- **Primary action: "Notify me when one is listed"** (fits the small-catalogue reality).
- **"Search all `<Model>` variants"** — one tap, clears the Engine-variant facet (widen the
  partial funnel).
- **"Clear the other filters"** — when fuel / quality / price filters are the cause.

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
  - **Fitment & liability** — what `✓ Confirmed fit` vs `From a matching car` mean; IVO is a
    marketplace and the **seller is the contracting party** per order.
  - **Demo-build disclaimer** — no real orders, payments, or personal data.
  - Legal copy is **placeholder** and needs a real pass before launch.

---

## 7. Out of scope for v1 (confirmed here)

- Keyword search, OEM part-number lookup, free category browse (funnel is the only entry).
- **Most Viewed** / any popularity or recommendation surface — deferred to v2.
- "Other parts from this donor vehicle" cross-links — still fog on the map.
- Real transmission data / a Gearbox facet that filters (slot reserved only).
- Buyer-reported "this didn't fit my car" feedback loop — map fog, may never graduate.
- Full non-English translation content.
