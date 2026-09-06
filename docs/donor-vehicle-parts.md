# "More parts from the same car" — v1

Resolves [Buyer-facing "more parts from this donor vehicle" view — v1 or not (#23)](https://github.com/Lucy-yunn/test/issues/23)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

The `DonorVehicle` and `Listing` entities (fields, relationships, the `Listing → DonorVehicle`
provenance link) live in [`docs/domain-model.md`](./domain-model.md). This document owns one
buyer-facing surface: a section on the listing detail page that lists the seller's **other
listings removed from the same physical car**.

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md).

---

## Terminology note — the vehicle catalogue

This document uses the vehicle-catalogue vocabulary settled by
[Vehicle-catalogue grain & the buyer-facing label for Modification (#21)](https://github.com/Lucy-yunn/test/issues/21):

- The buyer-facing hierarchy is **Make → Model → Generation → Category**.
- **`VehicleGeneration`** is the catalogue leaf and the funnel's third step; it replaces the
  earlier `Modification` term.
- There is **no "Model Group"** entity or label. The `Model` value may itself be a grouped
  name — `A4, S4`, `A6, S6`, `80, 90`.
- Worked example: `Audi → A4, S4 → A4 S4 B5 8D (1994–1999) → Headlights`.

The repo-wide rename (`CONTEXT.md`, [`docs/domain-model.md`](./domain-model.md),
[`docs/buyer-funnel-search.md`](./buyer-funnel-search.md), the Fitment doc) is **#21's
deliverable**, not this one. This document is written to land cleanly on top of it; if #21's
final label differs, only the strings here change, not the design.

---

## 1. The decision

**In for v1, minimal.** The listing detail page gets **one** section — *"More parts from the
same car"* — listing the other active `Listing`s that share this listing's `donorVehicleId`.

Rationale:

- A `DonorVehicle` is a first-class entity ([#2](https://github.com/Lucy-yunn/test/issues/2)),
  so the data is already joined — `donorVehicleId` + `Listing.status` is all the section needs.
- Dismantlers list many parts per car. A buyer rebuilding one damaged area (headlight +
  bracket + wing + indicator) can source them from **one seller, one shipment** — and because
  `Listing.sellerId == donorVehicle.sellerId` is an invariant, every sibling listing is
  guaranteed same-seller.
- It is a **lateral move** from a listing the buyer already reached through the funnel. It is
  **not** a second search entry point, so it does not conflict with "the funnel is the only
  way in" ([#9](https://github.com/Lucy-yunn/test/issues/9)).

**Out of scope for v1** (see §8): a dedicated or shareable donor-vehicle page, any new search
entry point, any new data-model element, category grouping within the section.

---

## 2. Where it appears

**Only on the listing detail page**, and only when that page is being served as a normal
shopping page — i.e. the listing is `published` or `reserved` and the viewer reached it
through browsing.

It is **suppressed**:

- When the listing has **no other visible sibling** (§5).
- When the retained (hidden) listing is being read **through an order** — a buyer viewing
  their `sold` / `cancelled` purchase via the order detail page
  ([#10](https://github.com/Lucy-yunn/test/issues/10) reads the item through to the retained
  `Listing`). The section is a shopping aid, not order information.

Placement on the page: below the listing's own details (photos, condition, known defects,
provenance line, price/buy) and below the "Message seller" entry — it is a secondary,
browse-onward element, not part of the purchase decision for *this* part.

---

## 3. What the section shows

### 3.1 Heading

> **More parts from the same car · 12**

The count is the number of visible siblings (§5 defines "visible"). Showing it is a mild
inventory-size signal, acceptable for a used-parts marketplace and useful to the buyer.

### 3.2 Caption (one line, under the heading)

> This seller removed these parts from the same vehicle — a `<year> <Make> <Model>
> <Generation label>`. They won't all fit your car; open a part to check its compatibility.

- The donor vehicle is named **once, here** — using the same masked descriptor rules as the
  rest of the listing page (masked VIN is **not** shown in this descriptor; it is the
  year/make/model/generation string).
- The caption is the **only** place the "same car ≠ fits your car" message appears. There is
  no per-card warning (§4).
- Final legal/tone polish of this copy is deferred with the rest of the site copy flagged in
  [#9](https://github.com/Lucy-yunn/test/issues/9). Do **not** use `Modification` or
  "Model Group" in buyer-facing copy.

### 3.3 Cards

Reuse the **existing listing card** component used elsewhere in Browse, with **two
differences** inside this section:

- **No fit badge** (§4).
- **The per-card "Taken from: `<generation>`" provenance line is suppressed** — it is
  identical on every card here and already stated in the caption. Pure noise in this context.

Each card links to that sibling's own listing detail page, where the normal treatment
(including the normal out-of-funnel fit presentation) applies.

### 3.4 Ordering

**Newest listed first**, flat list. Matches the funnel's secondary sort
([#9](https://github.com/Lucy-yunn/test/issues/9): "confirmed-fit, then newest") with the fit
dimension removed. Category grouping is a fast-follow (§8), not v1.

### 3.5 Size and "See all"

- Initial render: up to **8** cards.
- If more exist, a **"See all"** control expands the section **in place** to show **all**
  remaining visible siblings — no pagination, no second cap. A dismantler realistically has
  well under ~20 active listings per car; paging is not worth building.

---

## 4. Fit signalling — badge-free

Cards in this section carry **no fit badge and no compatibility note**.

This is **not a new rule** — it is the existing out-of-funnel rule from
[`docs/fitment-and-compatibility-search.md`](./fitment-and-compatibility-search.md) (#7): a
listing shown outside funnel context (from a favourite, a thread, an order re-entry) omits
the `✓ Confirmed fit` / `From a matching car (unverified)` badge and the `Fitment.note`,
because there is no buyer `VehicleGeneration` in context to judge against. A
"more parts from the same car" card is outside funnel context by the same logic.

Sharing a `donorVehicleId` **never** implies compatibility. Fitment remains governed entirely
by the normal `Fitment` rules (#7): a sibling part fits the buyer's car only if it has a
`Fitment` row for the buyer's `VehicleGeneration`, or if the buyer's generation happens to be
this donor vehicle's generation (the provenance path). Either way, that judgement is made on
the sibling's **own** listing page when the buyer opens it — not inferred here.

No `⚠ compatibility not checked` marker on cards: the §3.2 caption carries that message once,
for the whole section.

---

## 5. Edge cases

| Situation | Behaviour |
|---|---|
| The car has **no other listing** in `published` or `reserved` | Section **hidden entirely** — no empty state, no zero-count heading. |
| Other siblings exist but are all `draft` / `sold` / `cancelled` / `archived` | Treated as no visible sibling → section **hidden**. Only `published` and `reserved` count (the buyer-visible statuses, per [#8](https://github.com/Lucy-yunn/test/issues/8)). |
| A sibling is `reserved` | **Shown** (it is buyer-visible per #8; its card reflects the reserved state as anywhere else). |
| The listing itself is `reserved` | Section still shown — the page is still a normal shopping page. |
| The listing is reached through an order (retained hidden listing) | Section **suppressed** (§2). |
| More than 8 visible siblings | Show 8, then **"See all"** expands all in place (§3.5). |

---

## 6. Privacy

**No additional masking beyond the existing [#8](https://github.com/Lucy-yunn/test/issues/8)
donor-data rules.**

The section shows the **same** donor vehicle (masked VIN, mileage, engine code as already
governed by #8; `vinDerivedNotes` staff-only) that is **already visible** on any single one
of that car's listing pages. Aggregating the siblings onto one section exposes nothing that
was not already one click away. There is no new re-identification surface worth a v1 control.

---

## 7. Data-model impact

**None.** The section is a query:

> other `Listing` where `donorVehicleId = <this listing's donorVehicleId>`
> and `status in ('published', 'reserved')`
> and `id <> <this listing's id>`,
> ordered by `publishedAt` desc, limit 8 (+ "see all" → no limit).

No new entity, field, relationship, or enum value. `docs/domain-model.md` needs only a
one-line pointer noting the listing detail page carries this section (added with this change).

---

## 8. Deferred (not in v1)

| Item | Note |
|---|---|
| Dedicated / shareable **donor-vehicle page** | Explicitly rejected for v1 — would be a second browse surface. Revisit only if buyers ask to link/share "this car". |
| **Category grouping** within the section | Genuinely useful for the "rebuild one corner" buyer; a fast-follow, not v1. |
| Fit badges on sibling cards | Would require evaluating each sibling's `Fitment` against the buyer's `VehicleGeneration` and only makes sense with funnel context carried through; out of scope with the #7 out-of-funnel rule. |
| Cross-seller "same car" linking | Structurally impossible in v1 anyway (`DonorVehicle` belongs to one `Seller`); not a goal. |
| "Notify me about new parts from this car" | No notification surface for this (`Notification` covers order + cancellation only — [#17](https://github.com/Lucy-yunn/test/issues/17)). |

---

## 9. No ADR

This decision is **cheap to reverse** (a self-contained section, no schema change, no
migration), so it does not meet the ADR bar. If v1 scope is later cut under time pressure,
this section is a clean thing to drop.
