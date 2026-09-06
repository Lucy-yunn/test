# v1 Seller Center — scope & metrics

Resolves [Seller center — v1 scope & metrics (#13)](https://github.com/Lucy-yunn/test/issues/13)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

Builds on [Core domain model (#2)](https://github.com/Lucy-yunn/test/issues/2),
[Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8),
[Order model (#10)](./order-model.md), and
[In-app messaging model (#11)](./messaging-model.md). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md). This document owns the **seller-center screen inventory, the
metrics that ship, how each is computed and displayed, and the explicit boundary against the
Q15 long-term vision** — it does not restate the order, listing, or messaging rules those
tickets already fixed.

---

## 1. Scope

The **seller center** is the area where a **Seller with a login** views their own Orders and
product performance (`CONTEXT.md`). It is **near-read-only**: it has exactly **two** write
actions (§4). Listing is never done here — staff enter and maintain every Listing (Q10).

- Only a Seller whose `Seller.userId` is set has a seller center at all. A login-less Seller
  has no seller center, no Messages, and no way to act on a cancellation — staff are the sole
  actor for them (#10 §6.3, #11 §2).
- Every screen is scoped to the signed-in Seller: `Seller.id` drives every query. A Seller
  never sees another Seller's orders, listings, threads, or figures.
- All figures are **current or all-time counts**. There is no date-range filter, no chart, no
  week-over-week comparison anywhere in v1 (§7).

Out of this ticket:
- The **admin tool** screens (staff-side order and product management) —
  [`docs/spec/admin-tool.md`](./spec/admin-tool.md).
- **Notifications** — email / push for new orders, cancellations, or messages is deferred to
  [Notifications (#17)](https://github.com/Lucy-yunn/test/issues/17). The seller center shows
  **in-app state only**: live counts and the #11 unread badge.
- **Seller account provisioning** (when and how a `Seller.userId` gets set) —
  [Auth, roles & permissions (#12)](https://github.com/Lucy-yunn/test/issues/12).

---

## 2. Navigation — five sections

| Section | Purpose | Write? |
|---|---|---|
| **Overview** | the landing page; read-only summary tiles (§5) | no |
| **Orders** | list + detail of the Seller's orders (§3) | approve cancellation only (§4) |
| **Listings** | list + detail of the Seller's listings, every status (§6) | no |
| **Messages** | the Seller's threads + reply box, per [messaging model (#11)](./messaging-model.md) §5 | send / report (§4) |
| **Store details** | read-only view of the Seller's own `displayName`, contact, and Location — exactly as buyers see it | no |

**Overview is the landing page.** There is no separate "Cancellations", "Marketing",
"Customer Service", "Finance", "Store Management", or "Subscriptions" navigation — see §8 for
the full list of what the Q15 vision defers.

Pending cancellations are surfaced as a **count on Overview** and a **pinned group at the top
of Orders** (§3), not as their own screen.

Nav badges: the **Messages** item carries the #11 unread count. No other nav badge in v1
(new-order and pending-cancellation counts live on Overview tiles; there is no
"seller acknowledged this order" state).

---

## 3. Orders

### 3.1 List

Every `Order` where `Order.sellerId` is the signed-in Seller, newest first (`placedAt`).

| Column | Source |
|---|---|
| Order code | `Order.internalCode` (`ORD-000123`) |
| Item | primary `ListingPhoto` + auto-composed title, read through to the retained Listing |
| Buyer | buyer name (`User.name`) — **not** address or phone in the list |
| Status | `Order.status` badge (`placed` / `confirmed` / `shipped` / `delivered` / `cancelled`) |
| Date | `placedAt` |
| Price | `itemPriceEur` |

- **Status filter** — a flat filter over the five `Order.status` values. **Not** the Q15
  "pending / processed / return-refund-cancel" bucket taxonomy: v1 has no returns/refunds
  feature behind such a bucket (§8).
- Any order with a **`pending` `CancellationRequest`** is pinned to the top of the list under
  a **"Cancellation requested"** heading, regardless of the active filter.
- A `cancelled` order shows its `lastReachedStatus` in the badge area ("Cancelled — was
  confirmed"), consistent with the buyer tracker (#10 §3).

### 3.2 Detail

The seller-side order view. Data and visibility are fixed by [order model (#10)](./order-model.md)
§11 — this ticket only places them on a screen:

- **Delivery** — the full delivery-address snapshot + buyer phone (the Seller needs both to
  arrange delivery).
- **Item** — primary photo, title, condition, key Part details, read through to the retained
  Listing (#10 §10.3).
- **Status tracker** — the four pipeline steps with per-transition timestamps
  (`confirmedAt` / `shippedAt` / `deliveredAt`), or the cancelled view with `lastReachedStatus`
  kept above and the cancellation reason below.
- **Shipping** — `shippingCostEur` + `shippingNotes` when staff have entered them; order total.
- **Tracking** — `trackingNumber` and `expectedTimeRange` once `shipped`.
- **Cancellation** — when a `CancellationRequest` exists: the `reason` (+ `reasonDetail`),
  `createdAt`, and `state`.

**Actions** (the only interactive controls on the page):
- **Approve cancellation** — shown only while the `CancellationRequest.state` is `pending`
  (§4). Beside it: the `autoApproveAt` date ("Auto-approves 13 Sep if not actioned") and a
  **"Message the buyer first"** link into the thread — the pending window is deliberately a
  chance to talk (#10 §6.2).
- **Message buyer** — opens or re-uses the `(listing, buyer)` thread (#11). Always present.

The Seller **cannot** confirm, mark shipped, enter tracking / expected-time, or mark delivered
— every order-lifecycle transition except cancellation approval stays with staff in the admin
tool (#10 §3, Q22).

---

## 4. Write actions — exactly two

The seller center is described as read-only; these two writes are the deliberate exceptions,
both inherited from closed tickets:

1. **Send a message / report a thread** — in Messages. Per [messaging model (#11)](./messaging-model.md):
   a plain-text reply (~4000-char cap, immutable once sent) in any of the Seller's threads,
   plus the **Report** control that raises a thread to the staff queue. This is *the* write
   surface the messaging model calls out (#11 §5).
2. **Approve a pending cancellation request** — on the Seller's own order (#10 §6.3). Approval
   is immediate and irreversible: `Order.status → cancelled` (with `lastReachedStatus` kept),
   `CancellationRequest.state → approved` (`resolvedBy = seller`), `Listing → published`.
   There is **no reject and no "decline"** — a Seller who wants the order to proceed simply
   does nothing and talks to the buyer; the request auto-approves after 7 days regardless
   (#10 §6.3).

Nothing else in the seller center writes. In particular there is **no listing edit, no
edit-request form, and no store-details edit** — staff maintain all of that (a structured
seller-to-staff change channel is [Seller inventory data-intake (#14)](https://github.com/Lucy-yunn/test/issues/14)
territory, not this ticket).

---

## 5. Overview

Six read-only tiles: a number, a label, and (where noted) a deep link. No trends, no deltas,
no sparklines.

| Tile | Value | Deep link |
|---|---|---|
| **Open orders** | count of `Order` (mine) with `status ∈ {placed, confirmed, shipped}` | Orders, filtered |
| **Pending cancellations** | count of `CancellationRequest` (`state = pending`) on my orders | Orders, pinned group |
| **Unread messages** | the [#11](./messaging-model.md) §6 unread count — `Message` in my threads, not sent by me, `readAt = null` | Messages |
| **Active listings** | count of `Listing` (mine) with `status ∈ {published, reserved}` | Listings, filtered |
| **Total favourites** | count of `Favorite` rows across all my listings (any status) | Listings |
| **Items sold** | count of `Order` (mine) with `status = delivered` | Orders, filtered |

Empty seller (login provisioned, nothing entered yet): tiles read `0` and the page carries a
one-line note that staff enter and manage listings (§9).

---

## 6. Listings

### 6.1 List

**Every** `Listing` where `Listing.sellerId` is the signed-in Seller, in **all six statuses**
— `draft`, `published`, `reserved`, `sold`, `cancelled`, `archived`. Buyers never see
`sold` / `cancelled` / `archived` / `draft`, but the Seller must (#8).

| Column | Source |
|---|---|
| Photo | primary `ListingPhoto` |
| Title | auto-composed |
| Category | `Part.category.name` |
| Price | `Listing.priceEur` |
| Status | `Listing.status` badge |
| Favourites | count of `Favorite` for this listing |
| Published | `publishedAt` (blank while `draft`) |

Status filter over the six values.

### 6.2 Category breakdown

A single small read-only block on the Listings screen: the Seller's **active** listings
(`status ∈ {published, reserved}`) grouped by **`Group`** (the ~13 frozen clusters —
`Part.category.group`), shown as plain counts:

> Lighting 5 · Brakes 4 · Engine 3 · Body 1

Deliberately minimal: **plain active-listing counts grouped by the frozen `Group` taxonomy,
nothing else.** No chart, no percentages, no revenue, no conversion, no category trend. It
exists to answer the Q15 "category breakdown" line at the lowest useful fidelity.

### 6.3 Detail

A read-only rendering of the Listing exactly as staff entered it:

- **Part** — name, Category, `attributes`, `PartNumber`s (or the "no visible number" note).
- **This item** — `condition` + `conditionNotes`, the `ListingDefect` list, photos,
  dimensions / weight, `priceEur`, `negotiable`.
- **Provenance** — the `DonorVehicle` (`label`, `VehicleGeneration`, and the nullable donor
  fields the Seller supplied at intake — engine / engine code / fuel / transmission / body /
  drivetrain; `vin` masked, consistent with the buyer view — #8 / #21).
- **Per-listing metrics** — three counts:

  | Metric | Computed from |
  |---|---|
  | Favourites | `Favorite` rows for this listing |
  | Orders | `Order` rows for this listing (usually 0–1; can exceed 1 historically if a cancelled order was followed by a re-list and later sale) |
  | Active threads | `Thread` rows for this listing |

- A line — *"To change anything on this listing, message IVO"* — and **no** structured form.

---

## 7. What every figure is (and isn't)

- Every number in the seller center is a **live count** (`COUNT(*)` over a scoped query) or an
  **all-time count**. Nothing is time-bucketed.
- **No monetary aggregates.** Individual `itemPriceEur` and `Listing.priceEur` are visible on
  each order and listing, but there is no "total earned" / "revenue" / "€ sold" figure
  anywhere. Checkout is stubbed (nothing is paid), there is no payout relationship, and an
  aggregate earnings number belongs with the deferred Finance module (§8).
- **No view / impression / visitor-click metric.** There is no entity for listing views in the
  domain model and none is added in v1; the buyer-homepage "Most Viewed" strip is itself
  deferred to v2 ([#9](./buyer-funnel-search.md)). Buyer interest is signalled by **favourites**
  and by **active threads** only. Adding view analytics later is a clean, isolated addition
  (a new `ListingView` event table + rollup) that nothing in the map depends on.

---

## 8. Not in v1 — the Q15 boundary

The Q15 / Q19 long-term seller-center vision is broad. This boundary is stated explicitly so
that later implementation work does not accidentally pull any of it back into scope. **None of
the following is in v1:**

| Deferred | Note |
|---|---|
| Side-nav modules: **Marketing Campaigns, Customer Service, Finance, Store Management, Subscriptions** | each first requires deciding how the platform charges money or sells ads (map "Out of scope" / fog) |
| **Ad / promoted-listing performance** | out of scope (map) — there is no advertising product |
| **Seller performance score, ratings, reviews** | no rating or review entity exists in the domain model |
| **Visitor clicks / view counts / "Most Viewed" for the seller** | no view-tracking entity; deferred (§7) |
| Order-status buckets **"pending / processed / return-refund-cancel"** | v1 uses a flat `Order.status` filter (§3.1); the return/refund bucket has no feature behind it |
| **Returns / refunds surface** | out of scope (map) — v1 is pre-ship cancellation only |
| **Seller editing** of listings, prices, photos, or store details | staff-only (Q10); a structured change channel is [#14](https://github.com/Lucy-yunn/test/issues/14) |
| **Trends, charts, date-range filters, period comparisons** | every figure is a current / all-time count (§7) |
| **Payout, invoicing, statements, settlement** | deferred with the Finance module |
| **Email / push notifications** for orders, cancellations, messages | [Notifications (#17)](https://github.com/Lucy-yunn/test/issues/17) |

---

## 9. Empty states

| Situation | Screen shows |
|---|---|
| Login provisioned, staff have not entered any listings yet | Listings: *"IVO is preparing your listings."* Overview tiles read `0`. |
| Listings exist, no orders yet | Orders: *"No orders yet."* + one line that staff enter and manage listings on the Seller's behalf. |
| No favourites / no threads | the metric simply reads `0` — no special copy. |

---

## 10. Buyer side — a favourited listing that becomes unavailable

Assigned to this ticket by [Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8):
a Buyer favourites a `published` Listing that later goes `reserved` (to someone else), `sold`,
`cancelled`, or `archived`. In the **Buyer's** favourites area:

- The row is **kept** — not auto-removed — and rendered greyed with a badge:

  | Listing status | Badge |
  |---|---|
  | `reserved` (by another buyer) | **Reserved** |
  | `sold` | **Sold** |
  | `cancelled` / `archived` | **No longer available** |

- It reads **through to the retained Listing** (the row is never deleted — same mechanism as
  the order detail page #10 §10.3 and the thread header #11 §3.3).
- A **"Find similar"** link re-enters the funnel at that Part's `Category` for the Buyer's
  vehicle.
- **No notification** is sent when the status changes — notifications are deferred to
  [#17](https://github.com/Lucy-yunn/test/issues/17).

---

## 11. Downstream / fog touched by this ticket

- **Seed-data plan** (map fog) — the demo seed plan must include **at least one login-enabled
  Seller** with enough **listings** (across several statuses and `Group`s), **favourites**,
  **orders** (across several statuses), **cancellation state** (at least one `pending`
  `CancellationRequest`), and **message threads** (with unread messages) to exercise every
  seller-center surface. Without it the seller center demos as a wall of zeros. This ticket
  records the requirement; the seed-data plan owns it.
- **Auth, roles & permissions ([#12](https://github.com/Lucy-yunn/test/issues/12))** — when
  and how `Seller.userId` is set, and the session / authorization checks that gate every
  seller-center query to the signed-in Seller.
- **Notifications ([#17](https://github.com/Lucy-yunn/test/issues/17))** — every "no
  notification" note above resolves there.
- **Final spec assembly ([#26](https://github.com/Lucy-yunn/test/issues/26))** — done: the
  admin-tool counterparts are in [`docs/spec/admin-tool.md`](./spec/admin-tool.md); the full
  screen inventory (incl. this seller center) is [`docs/spec/screens.md`](./spec/screens.md).
