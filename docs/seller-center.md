# v1 Seller Center — scope & actions

Originally resolved [Seller center — v1 scope & metrics (#13)](https://github.com/Lucy-yunn/test/issues/13)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1). **Revised 2026-09-19**:
the seller now operates orders and replies to reviews, so the seller center is no longer
read-only. See [ADR-0009](./adr/0009-seller-operated-orders-cash-on-delivery.md).

Builds on [Order model](./order-model.md), [messaging model](./messaging-model.md),
[reviews](./reviews.md) and [credits](./seller-credits.md). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md). The roles are **buyer**, **seller**, **staff**.

---

## 1. Scope

The **seller center** (`/seller/*`) is where a **seller** runs their orders and sees their stock,
reviews and credits. **Every seller has a login**, so every seller has one.

- **Listing is still staff-entered.** A seller never creates or edits a Listing, a donor vehicle,
  a price or a photo. Staff do that from the seller's intake sheet ([`seller-intake.md`](./seller-intake.md)).
- Every screen is scoped to the signed-in seller. A seller never sees another seller's orders,
  listings, threads, reviews or figures.
- Figures are **live or all-time counts**. There is no date-range filter, chart or trend.

Out of scope: marketing, customer service, finance and store-management modules, ad performance,
returns and refunds surfaces, payout and invoicing (§8).

---

## 2. Navigation

| Section | Purpose | Seller can write? |
|---|---|---|
| **Overview** | landing page, summary tiles (§5) | no |
| **Orders** | list and detail of the seller's orders (§3) | **yes** — confirm, complete, refuse, approve cancellation (§4) |
| **Listings** | list and detail of the seller's listings, every status (§6) | no |
| **Messages** | threads and the reply box, per [messaging model §5](./messaging-model.md) | send, report |
| **Reviews** | reviews of this seller, with a reply box ([`reviews.md`](./reviews.md) §6) | reply once per review |
| **Credits** | balance and ledger ([`seller-credits.md`](./seller-credits.md) §5) | no |
| **Store details** | the seller's own public profile fields, as buyers see them | no |
| **Notifications** | the feed ([`notifications.md`](./notifications.md) §5) | mark read |

Nav badges: Messages shows unread messages; Notifications shows unread notifications.

Pending cancellations are surfaced as an Overview tile and a pinned group at the top of Orders.

---

## 3. Orders

### 3.1 List

Every `Order` where `Order.sellerId` is the signed-in seller, newest first.

| Column | Source |
|---|---|
| Order code | `Order.internalCode` |
| Item | primary photo and auto-composed title, read through to the retained Listing |
| Buyer | buyer name only (no address or phone in the list) |
| Status | badge: `placed`, `confirmed`, `completed`, `cancelled`, `refused` |
| Placed | `placedAt`, plus age for open orders |
| Price | `itemPriceEur` |

- A flat **status filter** over the five values.
- Orders with a `pending` cancellation are pinned to the top under **"Cancellation requested"**.
- A `cancelled` order shows its `lastReachedStatus` ("Cancelled, was confirmed").

### 3.2 Detail

Data and visibility are fixed by [order model §11](./order-model.md). On the screen:

- **Delivery** — the full delivery snapshot and the buyer's phone, needed to book the courier.
- **Payment reminder** — "Cash on delivery: the buyer pays you after inspecting the part."
- **Item** — photo, title, condition, key Part details, read through to the Listing.
- **Status tracker** — `placed → confirmed → completed`, with timestamps, or the cancelled or
  refused view.
- **Cancellation** — when a request exists: reason, detail, date and state.

### 3.3 Actions — only the seller

| Action | Shown when | Effect |
|---|---|---|
| **Confirm order** | `placed` | → `confirmed` |
| **Mark completed** | `confirmed`, no pending cancellation | → `completed`; Listing → `sold`; the buyer is invited to review |
| **Mark refused** | `confirmed`, no pending cancellation | → `refused`; Listing → `published`; optional note |
| **Approve cancellation** | a `pending` request exists | immediate, irreversible: order → `cancelled`, Listing → `published`. Beside it: the auto-approve date and a **Message the buyer first** link |
| **Message buyer** | always | opens or reuses the Thread for that Listing |

There is no reject on a cancellation request: a seller who wants the order to proceed talks to the
buyer, and the request auto-approves after 7 days regardless ([order model §6.3](./order-model.md)).

---

## 4. Write actions

The seller center's writes are exactly these:

1. **Order actions** — §3.3.
2. **Send a message / report a thread** — Messages.
3. **Reply to a review** — one reply per review, plain text, not editable.
4. **Change own password.**

Nothing else writes. In particular there is **no Listing edit, no price change, no store-details
edit and no credit purchase**.

---

## 5. Overview

Read-only tiles: a number, a label and a deep link.

| Tile | Value | Deep link |
|---|---|---|
| **Open orders** | count of own orders with `status ∈ {placed, confirmed}` | Orders, filtered |
| **Pending cancellations** | own `CancellationRequest`s with `state = pending` | Orders, pinned group |
| **Unread messages** | `Message` in own threads, not sent by me, `readAt = null` | Messages |
| **Active listings** | own `Listing` with `status ∈ {published, reserved}` | Listings, filtered |
| **Total favourites** | `Favorite` rows across all own listings | Listings |
| **Items sold** | own orders with `status = completed` | Orders, filtered |
| **Rating** | the reviews aggregate, or **New seller** | Reviews |
| **Credits** | current balance; shown with a warning style at 5 or fewer | Credits |

An empty seller (login provisioned, nothing entered yet) sees zeros and a note that staff enter
and manage listings.

---

## 6. Listings

### 6.1 List

**Every** `Listing` where `Listing.sellerId` is the signed-in seller, in **all six statuses** —
buyers never see `sold` / `cancelled` / `archived` / `draft`, but the seller must.

| Column | Source |
|---|---|
| Photo | primary `ListingPhoto` |
| Title | auto-composed |
| Category | `Part.category.name` |
| Price | `Listing.priceEur` |
| Status | badge |
| Favourites | count of `Favorite` |
| Published | `publishedAt` |

With a status filter.

### 6.2 Category breakdown

A small block: active listings (`published`, `reserved`) grouped by `Group`, as plain counts
("Lighting 5 · Brakes 4 · Engine 3").

### 6.3 Detail

A read-only rendering of the Listing exactly as staff entered it: Part, this item (condition,
defects, photos, dimensions, price), provenance (the donor vehicle and its structured detail,
VIN masked), and three counts (favourites, orders, active threads). A line: *"To change anything
on this listing, message IVO."*

---

## 7. What every figure is

- Every number is a live count over a scoped query, or an all-time count. Nothing is time-bucketed.
- **No monetary aggregate** of the seller's sales. The platform does not see the sale price
  actually paid; it sees only the Listing price. Credits are shown as a plain balance.
- **No view or impression metric.** Interest is signalled by favourites and threads.

---

## 8. Not in v1

| Deferred | Note |
|---|---|
| Marketing, customer-service, finance, store-management and subscription modules | out of scope |
| Ad or promoted-listing performance | no advertising product |
| A seller performance score beyond the review rating | none |
| View counts and "Most Viewed" | no view entity |
| Order-status buckets by returns and refunds | no returns feature |
| Seller editing of listings, prices, photos or store details | staff only |
| Trends, charts, date ranges | live counts only |
| Payout, invoicing, statements | credits only |
| Seller-initiated credit purchase | [`seller-credits.md`](./seller-credits.md) §4 |
| Email or push notifications | [ADR-0008](./adr/0008-in-app-notifications-email-deferred.md) |

---

## 9. Empty states

| Situation | Screen shows |
|---|---|
| Login provisioned, no listings yet | Listings: *"IVO is preparing your listings."* Tiles read `0`. |
| Listings but no orders | Orders: *"No orders yet."* plus one line that staff enter and manage listings. |
| No reviews | Reviews: *"No reviews yet."* |
| No favourites or threads | the metric reads `0` |

---

## 10. Buyer side — a saved part that becomes unavailable

A buyer saves a `published` Listing that later goes `reserved` for someone else, `sold`,
`cancelled`, or `archived`. In the buyer's **Saved Parts** area ([`seller-profile.md`](./seller-profile.md) §8):

- The row is **kept**, greyed, with a badge:

  | Listing status | Badge |
  |---|---|
  | `reserved` (by another buyer) | **Reserved** |
  | `sold` | **Sold** |
  | `cancelled` / `archived` | **No longer available** |

- It reads through to the retained Listing.
- A **"Find similar"** link re-enters the funnel at that Part's `Category`.
- No notification is sent when the status changes.

---

## 11. Downstream

- **Seed data** must include a login-enabled seller with listings across all six statuses, saved
  parts and saved sellers, orders in `placed`, `confirmed`, `completed`, `cancelled` and
  `refused`, one `pending` cancellation, threads with unread messages, reviews with and without a
  reply, and a credit ledger with a low balance ([`spec/seed-data.md`](./spec/seed-data.md)).
- **Auth** — how a seller login is provisioned and disabled: [`auth-and-permissions.md`](./auth-and-permissions.md) §4.
