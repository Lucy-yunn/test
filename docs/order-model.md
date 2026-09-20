# v1 Order Model — reservation, seller-operated lifecycle, cash on delivery

Originally resolved [Order model & stubbed checkout (#10)](https://github.com/Lucy-yunn/test/issues/10)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1). **Revised 2026-09-19**
by the founders' v1 scope change: payment is cash on delivery outside the platform, and the
seller (not staff) operates the order. Decision record: [ADR-0009](./adr/0009-seller-operated-orders-cash-on-delivery.md).

Builds on [Core domain model (#2)](https://github.com/Lucy-yunn/test/issues/2) and
[Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md); the entity/field skeleton lives in
[`docs/domain-model.md`](./domain-model.md). This document owns **the lifecycle, the reserve
flow, the cancellation flow, and the visibility rules**.

The three roles are used exactly as defined in `CONTEXT.md`: **buyer**, **seller**, **staff**.

---

## 1. Scope

An **Order** is a buyer's reservation of **exactly one Listing**. No cart, no line items.

**No payment on the platform.** The buyer pays the seller's price and the courier fee to the
courier on handover, after inspecting the part (Bulgaria's "inspect, then pay" delivery). The
platform records who reserved what and what happened, and nothing else. There is **no
shipping, tracking, expected-time, or receipt-confirmation flow**.

Out of scope:
- **Returns and refunds** after handover. A buyer who declines at the courier is `refused`
  (§3); anything later is a matter between buyer and seller.
- **Notifications** — [`notifications.md`](./notifications.md).
- The seller-center and admin screens — [`seller-center.md`](./seller-center.md),
  [`spec/admin-tool.md`](./spec/admin-tool.md). This document fixes the order-side data and
  rules those screens act on.

---

## 2. The reserve action

The buyer is on a Listing page whose `status` is `published`.

1. Buyer clicks **Reserve this part**.
   - **Not signed in** → sent to login or register, then returned to this step.
   - **Signed in as `seller` or `staff`** → the button is disabled with a short note
     ("Reserving is for buyer accounts").
   - **The Listing's seller has no active login** → the button is disabled with
     "This seller is temporarily unavailable" (see [`auth-and-permissions.md`](./auth-and-permissions.md) §4.4).
2. **Confirmation page** — a single lightweight page:
   - the item (primary photo, auto-composed title, condition, `priceEur`);
   - the buyer's **saved delivery address**, with an **Edit** control. The city is
     pre-filled from the buyer's confirmed delivery city ([`buyer-funnel-search.md`](./buyer-funnel-search.md) §6);
   - a plain statement: **cash on delivery — you pay the seller after inspecting the part at
     the courier; the price shown excludes the courier fee, which you pay to the courier**;
   - a **Reserve this part** button.
3. Buyer confirms. Then:
   - an `Order` is created with `status = placed`;
   - `itemPriceEur` and the **delivery-address snapshot** are written onto the Order (§4);
   - `placedAt` is set and the `Listing` transitions `published → reserved`;
   - the seller receives a notification;
   - the buyer lands on the **order detail page** (§7).

### Concurrency

Only a `published` Listing can be reserved. The `published → reserved` transition is the gate:
a second buyer who reaches the button after the Listing is already `reserved` or `sold` sees
"This item is no longer available" and no Order is created. First to reserve wins.

---

## 3. Lifecycle

```
                 ┌─────────┐       ┌───────────┐       ┌───────────┐
 reserve  ─────▶ │ placed  │ ────▶ │ confirmed │ ────▶ │ completed │  (terminal)
                 └────┬────┘       └─────┬─────┘       └───────────┘
                      │                  │  └────────▶ refused        (terminal)
                      │ buyer cancels    │ cancellation approved
                      ▼                  ▼
                 ┌─────────────────────────────┐
                 │          cancelled          │  (terminal)
                 │   lastReachedStatus kept    │
                 └─────────────────────────────┘
```

`Order.status` enum: `placed | confirmed | completed | cancelled | refused`.
All transitions are manual and made by a person. The only automated transition is the 7-day
cancellation auto-approve (§6).

| From | To | Trigger | Actor | Guard | Side effects |
|---|---|---|---|---|---|
| — | `placed` | **Reserve this part** | buyer | Listing is `published`; actor is `role = buyer`; seller has an active login | Listing → `reserved`; `itemPriceEur` + address snapshot; `placedAt` |
| `placed` | `confirmed` | **Confirm order** | seller | own order | `confirmedAt` |
| `placed` | `cancelled` | **Cancel order** | buyer | own order | see §6.1: Listing → `published`; `cancelledAt` |
| `confirmed` | `completed` | **Mark completed** | seller | own order; **no pending `CancellationRequest`** | Listing → `sold`; `completedAt` |
| `confirmed` | `refused` | **Mark refused** | seller | own order; **no pending `CancellationRequest`** | Listing → `published`; `refusedAt`; optional `refusalNote` |
| `confirmed` | `cancelled` | a `CancellationRequest` is **approved** (§6.2) | seller, or the system after 7 days | a `pending` request exists | Listing → `published`; `cancelledAt`; `lastReachedStatus = confirmed` |

**Meaning of each status**
- `placed` — the buyer has committed and the item is held (`reserved`). Nothing paid.
- `confirmed` — the **seller** checked that the part still exists and will hand it to the courier.
- `completed` — the **seller** marked that the buyer took the part and paid. The sale is done.
- `refused` — the **seller** marked that the buyer inspected the part at the courier and declined it. The Listing is on sale again.
- `cancelled` — cancelled before handover, by the buyer directly (`placed`) or by an approved request (`confirmed`).

**Terminal states:** `completed`, `refused`, `cancelled`. No transitions out of any of them.

**Staff never advance an order and never set `sold` on the Listing.** Staff cannot observe the
facts these statuses assert. Staff see every order read-only (§11).

**A stuck order stays stuck.** There is no timeout on `placed` or `confirmed`. If a seller never
responds, the Listing stays `reserved` until the buyer cancels. Staff see the age of every open
order in the admin list and chase the seller themselves.

### `lastReachedStatus`

Stored on the Order and set only when it moves to `cancelled`, to the status it held (`placed`
or `confirmed`). The buyer tracker renders the pipeline as done up to `lastReachedStatus`, then
shows a **Cancelled** marker below it.

---

## 4. Delivery address & contact

The `Buyer` profile holds a **saved delivery address**, editable in buyer settings. At the
confirmation page the buyer confirms or edits it; the final values are **snapshotted onto the
Order** so a later profile edit never rewrites a placed order. The seller uses the snapshot to
book the courier.

| Field | Required | Notes |
|---|---|---|
| `recipientName` | yes | |
| `phone` | yes | the seller and courier need it |
| `addressLine1` | yes | |
| `addressLine2` | no | |
| `city` | yes | pre-filled from the buyer's confirmed delivery city |
| `postcode` | yes | |
| `country` | yes | defaults to Bulgaria |

The snapshot is a flat group of columns or an embedded value, never a foreign key to a mutable
address row.

The Listing keeps its optional `lengthCm` / `widthCm` / `heightCm` / `weightKg` /
`packageSizeNotes`, displayed on the listing page so the buyer can estimate the courier fee.
Nothing computes a price from them. **There are no shipping-cost fields on the Order.**

---

## 5. (removed)

Shipping cost, tracking and expected-time were removed with the shipped/delivered states
([ADR-0009](./adr/0009-seller-operated-orders-cash-on-delivery.md)). Section numbering is kept
so external links to §6 onwards still resolve.

---

## 6. Cancellation

### 6.1 When it is possible

Only while the order is `placed` or `confirmed`, that is, before handover. After `confirmed`
the only remaining outcomes are `completed` and `refused`, both set by the seller.

**Every cancellation records a reason** chosen by the buyer:

| Reason (enum) | Label shown |
|---|---|
| `found_elsewhere` | Found the part cheaper / elsewhere |
| `no_longer_needed` | No longer need the part |
| `seller_too_slow` | Seller took too long to confirm |
| `condition_or_fitment_concern` | Concerns about the part's condition or fitment |
| `ordered_by_mistake` | Ordered by mistake |
| `other` | Other, free text, **required** when chosen |

### 6.2 Two paths, one record

Both paths create a **`CancellationRequest`** so the reason is stored the same way.

- **Order is `placed` — instant.** The buyer clicks **Cancel order**, picks a reason, and the
  request is created already `approved` with `resolvedBy = buyer`. The Order goes straight to
  `cancelled` and the Listing to `published`. The seller has not committed yet, so no approval is
  needed.
- **Order is `confirmed` — by request.** The request is created `pending`. The order's status
  does **not** change and the Listing stays `reserved`. A banner shows on the buyer and seller
  order pages: *"Cancellation requested. Auto-approves 13 Sep."* The pending window is a chance
  for the seller and buyer to talk (Messages).

### 6.3 Resolution of a pending request — approval only

A pending request **always ends in approval**; only the timing varies:

- **The seller approves** (seller center) — immediate.
- **Auto-approve** — **7 days after `createdAt`**, `resolvedBy = auto`.

**Staff cannot approve and cannot raise a cancellation.** There is **no reject** and the buyer
**cannot withdraw**; a buyer who changes their mind reserves the part again once it is
`published`. On approval:
- `Order.status → cancelled`, `lastReachedStatus = confirmed`, `cancelledAt` set;
- `CancellationRequest.state → approved`, `resolvedAt`, `resolvedBy` set;
- `Listing` → `published`.

### 6.4 What a pending request blocks

While a request is `pending` the seller **cannot** mark the order `completed` or `refused`. The
request must resolve first. In practice a pending request means the order will be cancelled.

### 6.5 The 7-day timer

- The deadline is `createdAt + 7 days`, stored as `autoApproveAt`.
- A daily **Vercel Cron** job approves every `pending` request past its deadline. As a safety
  net, the order pages and the admin list also resolve an overdue request lazily on read.
- The old "2 days before" warning notification is dropped ([`notifications.md`](./notifications.md)).

---

## 7. The order detail page (buyer)

Reachable only by the buyer who placed the order.

- **Status tracker** — `placed → confirmed → completed`. A short static line under the current
  step: `placed` "The seller will confirm shortly", `confirmed` "The seller is arranging the
  courier — pay on delivery after inspecting", `completed` none. If `refused`, the tracker ends
  with a **Refused** marker. If `cancelled`, the pipeline is done up to `lastReachedStatus` with
  a **Cancelled** marker and the reason below.
- **The item** — read through to the retained Listing, because the Listing is never deleted.
  The Order snapshots only `itemPriceEur` and the delivery address.
- **Payment note** — the cash-on-delivery statement from §2.
- **Delivery address** — the snapshot.
- **Seller** — display name, avatar, rating and city, linking to the seller profile. The phone
  number follows the profile rule: shown because the buyer is signed in.
- **Actions**, contextual:
  - **Cancel order** — when `placed` (instant) or `confirmed` with no pending request (§6);
  - **Message seller** — always; opens or creates the `Thread` for this Listing;
  - **Leave a review** — when `completed` and not yet reviewed ([`reviews.md`](./reviews.md)).

Placing an order does not auto-create a `Thread`.

---

## 8. (removed)

Expected-time copy was removed with the shipping fields. See §5 for the numbering note.

---

## 9. (removed)

The buyer "Confirm receipt" action was removed. `completed` is set only by the seller. See §5.

---

## 10. Entities

### Order

| Field | Type | Notes |
|---|---|---|
| `internalCode` | string, unique | readable code, `ORD-000123` |
| `buyerId` | FK → Buyer, required | |
| `sellerId` | FK → Seller, required | denormalised from the Listing |
| `listingId` | FK → Listing, required | the one reserved Listing |
| `itemPriceEur` | decimal, required | snapshot of `Listing.priceEur` at placement |
| `status` | enum, required | `placed \| confirmed \| completed \| cancelled \| refused` |
| `lastReachedStatus` | enum, nullable | set only on cancellation (§3) |
| `refusalNote` | text, nullable | optional note when the seller marks `refused` |
| delivery-address snapshot | 7 columns / embedded value | see §4 |
| `placedAt` | timestamp, required | |
| `confirmedAt` `completedAt` `cancelledAt` `refusedAt` | timestamp, nullable | one column per transition |

Relationships: → 1 `Buyer`, → 1 `Seller`, → 1 `Listing`, → 0..1 `CancellationRequest`,
→ 0..1 `Review` (the review linked to this order).

**Removed:** `shippingCostEur`, `shippingNotes`, `expectedTimeRange`, `trackingNumber`,
`shippedAt`, `deliveredAt`.

#### Item display after the Listing is hidden

A `Listing` is never deleted. Once `sold` it drops out of Browse, but the row stays and the
buyer's order page reads through to it. The Order does not snapshot display fields.

### CancellationRequest

| Field | Type | Notes |
|---|---|---|
| `orderId` | FK → Order, required | **0..1 per Order** |
| `reason` | enum | see §6.1 |
| `reasonDetail` | text, nullable | **required** when `reason = other` |
| `state` | enum | `pending \| approved` |
| `createdAt` | timestamp, required | |
| `autoApproveAt` | timestamp, required | `createdAt + 7 days` (unused when created `approved`) |
| `resolvedAt` | timestamp, nullable | |
| `resolvedBy` | enum, nullable | `buyer \| seller \| auto` |

**Removed:** `requestedBy` — only the buyer raises a request.

Invariants, enforced in the DAL:
- created only while the Order is `placed` or `confirmed`, and at most one per Order;
- at `placed` it is created `approved` with `resolvedBy = buyer`; at `confirmed`, `pending`;
- while `pending`, the Order cannot move to `completed` or `refused`;
- approving a request is the only way an order reaches `cancelled` from `confirmed`.

---

## 11. Visibility

| Viewer | Sees | Can do |
|---|---|---|
| **staff** (admin tool) | every order, read-only: the delivery snapshot, buyer name and phone, every status and timestamp, the age of open orders, the cancellation and its reason | nothing — no buttons on orders |
| **seller** (seller center) | own orders: full delivery snapshot, buyer phone, item, status, cancellation and reason | confirm, mark completed, mark refused, approve a pending cancellation |
| **buyer** (order page) | own orders only: seller name, avatar, rating, city and (signed in) phone; never the seller's street address | cancel, message, leave a review |
| any other buyer | nothing | — |

---

## 12. Downstream

- **Seller center** owns the screens that carry the seller's actions — [`seller-center.md`](./seller-center.md).
- **Reviews** hang off completed orders — [`reviews.md`](./reviews.md).
- **Credits** are not touched by orders: a cancelled order returns the Listing to `published`
  with no new credit charge — [`seller-credits.md`](./seller-credits.md).
- **Notifications** — [`notifications.md`](./notifications.md).
- Decision records: [ADR-0005](./adr/0005-always-approves-cancellation.md) (amended),
  [ADR-0009](./adr/0009-seller-operated-orders-cash-on-delivery.md).

---

## 13. Build notes (step 10)

- `Order.listingId` is not unique. A listing goes back on sale after a cancelled or refused order
  and can be reserved again, so one listing can have several orders over time. Only one is open at
  a time, because reserving needs the listing to move `published -> reserved`.
- Every change to an order locks the order row first, then reads its state. A click on **Mark
  completed** and the buyer's cancellation request therefore cannot both win.
- The daily sweep is `GET /api/cron/cancellations`, scheduled in `vercel.json`. It needs the
  `CRON_SECRET` environment variable and refuses every request without it.
- Notifications are written in build step 14, so placing or changing an order does not notify yet.
- The buyer order page has no **Leave a review** button until reviews (step 12), and **Message
  seller** is disabled until messaging (step 11).
