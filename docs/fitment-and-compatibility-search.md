# Fitment & compatibility search — v1

Resolves [Fitment model & staff-entry workflow (#7)](https://github.com/Lucy-yunn/test/issues/7)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

The `Fitment` entity (fields, relationships, grain) lives in
[`docs/domain-model.md`](./domain-model.md). This document owns the parts that don't fit an
entity model: **what a `Fitment` row means**, **how staff create one**, and **how buyer
search combines Fitment with Provenance**.

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md).

---

## 1. What a Fitment row means

A **`Fitment`** row is a **verified staff assertion**: "this `Part` fits this `Modification`".

- There is **no status / confidence enum.** A row exists ⇒ it is verified. If staff are not
  sure a Part fits a Modification, they do **not** create the row.
- `verifiedBy` (staff `User`) and `verifiedAt` are the **audit** of that deliberate act — who
  asserted it and when — not a workflow state.
- Fitment is **never inferred** from a `DonorVehicle`. A part coming off a car of Modification
  M does not create `Fitment(part, M)` automatically — only a staff member's positive action
  does (see §2.2).
- Grain is **`Modification` only** (locked in #2). "Fits a whole `VehicleModel`" is a
  data-entry shortcut (§2.3), not a coarser row.

### Caveats within a Modification: the `note` field

Modification grain is deliberately coarse — it does not split facelift / pre-facelift,
petrol / diesel sub-variants, transmission, etc. When a Part fits a Modification only under a
condition, staff record it in the **nullable free-text `Fitment.note`**
(`"petrol engines only"`, `"pre-facelift only"`, `"manual transmission only"`).

`note` is **buyer-visible** (§3.3). It is the mechanism that lets v1 stay at Modification
grain without inventing a finer structure: a caveat the funnel cannot encode is carried on
the row and shown before purchase.

---

## 2. Staff fitment-entry workflow

### 2.1 The Part detail page (manual path)

The admin tool's **Part detail page** has a **Fitment section**:

- **Current fitments** — the list of `Modification`s this Part is verified to fit, each with
  its optional `note`, `verifiedBy`, `verifiedAt`. Rows can be **removed** (§2.4).
- **Add a fitment** — staff pick a `Modification` from the hand-built catalogue
  (`VehicleMake → VehicleModel → Modification`), optionally type a `note`, and save. This
  creates one `Fitment` row with `verifiedBy = current staff user`, `verifiedAt = now`.
- **Whole-model shortcut** — §2.3.
- **Add a Modification for fitment** — if the `Modification` a Part fits is **not yet in the
  catalogue** and no `DonorVehicle` has introduced it (e.g. the Part demonstrably fits a
  BMW E90 320d but no pilot seller has dismantled one), staff can **add that Modification to
  the catalogue from here**, then hang the Fitment on it. The Modification catalogue
  therefore grows from **two** sources: `DonorVehicle` intake (#8) **and** fitment entry.
  This is a deliberate widening of the #4 framing ("only Modifications matching pilot
  sellers' donor vehicles") — it lets a buyer whose car no pilot seller has dismantled still
  complete the funnel and find parts.

### 2.2 The listing-intake prompt (primary data source)

Most `Fitment` rows are born during **listing intake**, not on the Part page.

Staff intake is donor-first (#5, #8): enter the `DonorVehicle` (always identified to a
`Modification` M), then add its parts as `Listing`s, each tied to a `Part`. When a `Part` is
attached to a `Listing` whose `DonorVehicle` is Modification M, the admin shows:

> ☐ This Part fits **`<M>`** — record as a confirmed Fitment?

- **Unchecked by default.** Staff must tick it — a positive act. An unticked box creates
  nothing. This keeps the rule in §1 intact: provenance never silently becomes fitment.
- Ticking it creates `Fitment(part, M)` with `verifiedBy` / `verifiedAt`, exactly as the
  manual path would. A `note` can be added in the same step.
- If `Fitment(part, M)` already exists, the prompt is not shown.

Rationale: the staff member is holding the part and knows which car it came off — a single
click is a genuine verification, and this is where the bulk of the compatibility data will
accumulate over time.

### 2.3 The whole-model shortcut

When a Part fits **every** variant of a `VehicleModel` (a cabin filter across all of Golf VII,
say), staff pick the **`VehicleModel`** instead of a single Modification. The UI **fans out**
to **one `Fitment` row per currently `isActive` `Modification`** of that Model. Each generated
row carries `note: "whole-model: <Model name>"` (merged with any staff-typed note) for
traceability.

- **No forward memory.** The shortcut is pure fan-out at the moment it is used. A
  `Modification` added to that Model **later** is **not** retroactively covered — a
  `VehicleModel`-grain `Fitment` is explicitly **deferred** (see §5).
- **Prompted re-apply.** When staff add a new `Modification` to a `VehicleModel` (via §2.1 or
  §2.4 intake), the admin surfaces: *"Parts previously marked as fitting all of `<Model>`:
  [list] — re-apply to this new variant?"* — a one-click fan-out to the new row, so coverage
  is not silently lost.

### 2.4 Removing / editing a fitment

- A wrong `Fitment` row is **hard-deleted** — no tombstone, no audit log entry (unlike #5's
  `Part` merges). Fitment is low-stakes reference data maintained by a two-person team.
- Editing a `note` is an in-place update.

### 2.5 Out of scope for this workflow

- **Seller-supplied compatibility claims** (a seller saying "this also fits a Passat"). These
  are raw intake data for staff to evaluate and then enter through §2.1 / §2.2. How sellers
  submit them is owned by [Seller inventory data-intake mechanism (#14)](https://github.com/Lucy-yunn/test/issues/14).
- **Part-number / catalogue cross-reference** to derive fitment automatically — no external
  parts catalogue in v1 (#5); `Category.tecdocGenericArticleIds` is reserved for later.

---

## 3. Buyer compatibility search

### 3.1 The union

The funnel (#9) resolves the buyer to a `Modification` **X** and a leaf `Category` **C**. The
result set is every **`Listing`** where `Listing.status ∈ {published, reserved}`,
`Listing.Part.categoryId == C`, and **either** match path holds:

| Path | Condition | Meaning |
|---|---|---|
| **Fitment** | `Listing.Part` has a `Fitment` row for **X** | Staff verified this Part fits X |
| **Provenance** | `Listing.donorVehicle.modificationId == X` | This physical part was removed from exactly that variant |

It is a **plain union** — either path is sufficient. Consequences:

- A `Part` with **zero** `Fitment` rows is still found, via the Provenance path only — the
  "mystery part off your exact car" safety net. This is a primary reason Provenance
  participates in search.
- The Provenance path fires **regardless of whether X is still `isActive`** (it is a
  historical fact; the funnel only offers active Modifications anyway).
- A Provenance match is **not** promoted to a `Fitment` row and does not become one on the
  next intake — it only affects this query.

### 3.2 Partial funnel

If the buyer stops at `VehicleModel` (no `Modification` chosen), **both** paths widen to "any
`Modification` of that Model":

- Fitment path: `Listing.Part` has a `Fitment` for **any** Modification of the Model.
- Provenance path: `Listing.donorVehicle.modificationId` is **any** Modification of the Model.

This backs the funnel's "stopping partway shows a list to continue from" (#18/#25).

### 3.3 Result labelling & ordering

Every result carries **one fit indicator**, derived from which path(s) matched:

| Matched | Badge | Order |
|---|---|---|
| Fitment (with or without Provenance) | **✓ Confirmed fit** — plus `Fitment.note` if the matched row has one | **First** |
| Provenance only | **From a matching car (unverified)** | After all Confirmed-fit results |

- "Confirmed fit" always sorts above "From a matching car". This is the only ordering rule
  this ticket fixes.
- **Ordering *within* each bucket** (price, recency, condition, …) is owned by
  [Buyer funnel search UX (#9)](https://github.com/Lucy-yunn/test/issues/9).
- The badge is honest about the difference: a Provenance-only match is strong evidence but
  not a staff compatibility check, and `DonorVehicle` data can be wrong or the donor car
  could have carried a non-original part.

### 3.4 Listing detail page

When the buyer arrived with funnel context (Modification X known), the listing detail page
shows, near the title:

- **The same one-line badge** as the result row — *"✓ Confirmed fit"* or *"From a matching
  car (unverified)"*.
- **`Fitment.note` immediately beside it** when the matched `Fitment` row has one —
  *"✓ Confirmed fit — note: petrol engines only"*.

**Provenance** (*"Removed from: `<masked donor label>`"*, per #8) stays its **own separate
line** — it is disclosure about the physical item, not a compatibility statement, and is not
merged into the badge.

No dedicated "Compatibility" section, no vehicle restatement, no full fitment list. If the
buyer has **no** funnel context (e.g. opened a `Favorite`, followed a link from a `Thread`,
or reached it from an `Order`), the badge and note are omitted; the listing and its
Provenance line render as normal.

---

## 4. Worked scenarios

| Buyer's car (X) | Part's Fitment rows | Listing's donor | Result |
|---|---|---|---|
| Golf VII 1.6 TDI (CLHA) | fits 1.6 TDI (CLHA) | 2.0 TDI | **✓ Confirmed fit**. Provenance line notes it came off a 2.0 TDI. |
| Golf VII 1.6 TDI (CLHA) | *(none)* | 1.6 TDI (CLHA) | **From a matching car (unverified)** — found via Provenance only. |
| Golf VII 1.6 TDI (CLHA) | fits 2.0 TDI only | 2.0 TDI | **Not in results** — neither path matches X. |
| Golf VII 1.6 TDI (CLHA) | fits 1.6 TDI, `note: "pre-facelift only"` | 1.6 TDI | **✓ Confirmed fit — note: pre-facelift only.** Buyer checks their build date. |
| BMW E90 320d (no pilot donor) | fits E90 320d (Modification added via §2.1) | *(part is from a 3-series parts lot)* | **✓ Confirmed fit** — funnel terminates on a Modification that exists only because of fitment entry. |

---

## 5. Deferred

- **`VehicleModel`-grain `Fitment`** — a single row meaning "fits the whole model, including
  variants added later". v1 uses fan-out (§2.3) instead. Revisit if the catalogue grows fast
  enough that prompted re-apply becomes a burden.
- **Automatic fitment from part-number cross-reference** — needs an external parts catalogue
  (#5, out of scope).
- **Buyer-reported fit errors** ("this didn't fit my car") — a feedback loop into the Fitment
  data. No buyer→staff channel for it in v1.

---

## 6. ADR candidate

The **search union — Fitment path ∪ Provenance path, with the Provenance-only match shown as
a distinct, lower-ranked "unverified" result** — is a candidate ADR for the "Final spec
assembly" ticket:

- **Hard to reverse** — it shapes the funnel result query, the compatibility index, and the
  buyer-facing badge vocabulary.
- **Surprising without context** — a future reader will ask why a Part with no compatibility
  data at all appears in compatibility search results.
- **A real trade-off** — against Fitment-only search (cleaner guarantee, but strands every
  numberless / fitment-less used part until staff get to it).

Consistent with #2 and #10, the ADR **file** is deferred to Final spec assembly, which owns
the ADR set and its numbering.
