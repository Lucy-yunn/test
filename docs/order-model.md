# v1 Order Model & Stubbed Checkout

Resolves [Order model & stubbed checkout (#10)](https://github.com/Lucy-yunn/test/issues/10)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

Builds on [Core domain model (#2)](https://github.com/Lucy-yunn/test/issues/2) and
[Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md); the entity/field skeleton lives in
[`docs/domain-model.md`](./domain-model.md). This document owns the **lifecycle, the checkout
flow, the cancellation flow, shipping, and the visibility rules** — the procedural detail the
domain model defers.

---

## 1. Scope

An **Order** is a Buyer's purchase of **exactly one Listing**. No cart, no line items, no
`OrderItem` (locked in #2 — every part is a unique single unit; multi-seller carts split into
N orders anyway; the checkout is stubbed so one-payment-many-items has no value yet).

**Stubbed checkout:** "Buy" creates the Order in `placed` with **no payment step, no escrow,
no staff approval gate**. Payment, escrow, and cross-border settlement are a separate business
problem, deferred (map "Out of scope").

Out of this ticket:
- **Notifications** (email vs in-app, for status changes and cancellations) — remains map fog,
  a dedicated cross-cutting ticket. The flow below works demo-wise with in-app state only.
- **Returns & refunds** — out of scope (map). v1 has pre-ship cancellation only.
- The **admin tool** and **seller center** *screens* — owned by the final spec assembly and
  by [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13). This document fixes
  the order-side data and rules those screens act on.

---

## 2. The "Buy" action (checkout)

The buyer is on a Listing page whose `status` is `published`.

1. Buyer clicks **Buy**.
   - **Not signed in** → send to login / register, then return to this step.
   - **Signed in as `seller` or `staff`** → the Buy button is disabled with a short note
     ("Buying is for buyer accounts"). Only `role = buyer` can purchase.
2. **Checkout confirmation page** — a single lightweight page, no multi-step wizard:
   - the item (primary photo, auto-composed title, condition, `priceEur`);
   - the buyer's **saved delivery address**, with an **Edit** control;
   - shipping shown as "arranged with the seller after purchase" (no cost yet — see §5);
   - a **Place order** button.
3. Buyer confirms (optionally editing the address first) and clicks **Place order**:
   - an `Order` is created with `status = placed`;
   - `itemPriceEur` and the **delivery-address snapshot** are written onto the Order
     (see §4);
   - `placedAt` is set;
   - the `Listing` transitions `published → reserved`;
   - the buyer lands on the **order detail page** (§7).

### Concurrency

Only a `published` Listing is buyable. The transition to `reserved` is the gate: a second
buyer who reaches **Place order** after the Listing is already `reserved` (or `sold`) gets
"This item is no longer available" and no Order is created. First to place wins.

---

## 3. Lifecycle

```
                 ┌─────────┐      ┌───────────┐      ┌─────────┐      ┌───────────┐
   place order → │ placed  │ ───▶ │ confirmed │ ───▶ │ shipped │ ───▶ │ delivered │  (terminal)
                 └────┬────┘      └─────┬─────┘      └─────────┘      └───────────┘
                      │                 │
                      │  cancellation   │  cancellation
                      │  approved       │  approved
                      ▼                 ▼
                 ┌───────────────────────────┐
                 │        cancelled          │  (terminal)
                 │  lastReachedStatus kept   │
                 └───────────────────────────┘
```

`Order.status` enum (locked, Q17): `placed | confirmed | shipped | delivered | cancelled`.
All transitions are **manual** — there is no carrier integration and no timed progression
(the one timer in the system is the cancellation auto-approve, §6).

| From | To | Trigger | Actor | Guard | Side effects |
|---|---|---|---|---|---|
| — | `placed` | **Place order** (checkout) | Buyer | Listing is `published`; actor is `role = buyer` | Listing → `reserved`; `itemPriceEur` + address snapshot written; `placedAt` set |
| `placed` | `confirmed` | **Confirm order** (admin tool) | Staff | — (allowed even with a pending cancellation request) | `confirmedAt` set; staff may now enter `shippingCostEur` + `shippingNotes` (§5) |
| `confirmed` | `shipped` | **Mark shipped** (admin tool) | Staff | **no pending `CancellationRequest`** | staff enters `expectedTimeRange` + `trackingNumber` (both required at this step); `shippedAt` set |
| `shipped` | `delivered` | **Confirm receipt** (buyer) *or* **Mark delivered** (admin tool) | Buyer or Staff | — | Listing → `sold`; `deliveredAt` set |
| `placed` / `confirmed` | `cancelled` | a `CancellationRequest` is **approved** (§6) | Seller / Staff / system (auto) | a `pending` request exists | Listing → `published`; `cancelledAt` set; `lastReachedStatus` = the status the order was in |

**Meaning of each status** (Q22):
- `placed` — the buyer has committed; the item is held (`reserved`). Nothing paid.
- `confirmed` — staff have checked with the seller: the part still exists and will ship.
- `shipped` — staff have entered the seller's expected-delivery window (free text) and a
  tracking number (free text).
- `delivered` — the buyer confirmed receipt, or staff marked it (buyer unresponsive).
- `cancelled` — a pre-ship cancellation was approved. Terminal.

**Terminal states:** `delivered` and `cancelled`. No transitions out of either. A problem after
`delivered` is a return / refund — out of scope for v1.

**Staff never set `sold` on the Listing by hand** (locked in #8). An offline sale is handled
as *cancel the order + note*, not by forcing the order forward.

### `lastReachedStatus`

Stored on the Order. Set only when the order moves to `cancelled`, to whichever status the
order held at that moment (`placed` or `confirmed`). The buyer's tracker renders the pipeline
as "done" up to `lastReachedStatus`, then shows the **Cancelled** marker below it (Q17).

---

## 4. Delivery address & contact

The `Buyer` profile holds a **saved delivery address**, editable in buyer settings. At
checkout the buyer confirms or edits it; the final values are **snapshotted onto the Order**
so a later profile edit never rewrites the history of a placed order.

**Field set** — identical on `Buyer` (saved) and `Order` (snapshot):

| Field | Required | Notes |
|---|---|---|
| `recipientName` | yes | |
| `phone` | yes | the seller needs it to arrange delivery |
| `addressLine1` | yes | |
| `addressLine2` | no | |
| `city` | yes | |
| `postcode` | yes | |
| `country` | yes | free selection; defaults to Bulgaria |

The snapshot lives on the Order as a flat group of columns (or an embedded value — a build
decision), never a foreign key to a mutable address row.

---

## 5. Shipping cost (v1 = option B)

The `Listing` carries optional `lengthCm` / `widthCm` / `heightCm` / `weightKg` /
`packageSizeNotes` (from #8). In v1 those are **displayed on the listing page** for buyer
reference and nothing computes a price from them.

The `Order` gains:
- `shippingCostEur` — nullable decimal;
- `shippingNotes` — nullable free text ("courier to be arranged", "buyer collects", …).

Both are **entered by staff in the admin tool, at or after the `confirmed` step**, and are
**display-only** — nothing is charged (the checkout is stubbed). The buyer sees, on the order
detail page: *"Shipping: €25.00 — arranged with the seller"* (or just the note if no amount is
set). The order **total** shown to the buyer is `itemPriceEur + shippingCostEur` (falling back
to `itemPriceEur` alone while shipping is unset).

Rejected: a shipping price on the Listing (option C) — it would reopen the closed #8.

---

## 6. Cancellation

### 6.1 When cancellation is possible

Only while the order is `placed` or `confirmed` — i.e. **pre-ship** (locked, Q23). Once the
order is `shipped`, there is **no cancellation**; the buyer's only route is the returns /
refunds flow, which is **out of scope for v1**.

### 6.2 The cancellation request

Cancellation is **not** an instant buyer action. It is a one-way request:

1. On the order detail page (status `placed` or `confirmed`), the buyer clicks **Cancel
   order** and must choose a **reason**:

   | Reason (enum) | Label shown |
   |---|---|
   | `found_elsewhere` | Found the part cheaper / elsewhere |
   | `no_longer_needed` | No longer need the part |
   | `seller_too_slow` | Seller took too long to confirm |
   | `condition_or_fitment_concern` | Concerns about the part's condition or fitment |
   | `ordered_by_mistake` | Ordered by mistake |
   | `other` | Other — free text, **required** when chosen |

2. A **`CancellationRequest`** is created with `state = pending`. The order's `status` does
   **not** change (it stays `placed` / `confirmed`); the pending request shows as a **banner**
   on the order tracker for both sides — *"Cancellation requested — awaiting the seller.
   Auto-approves 13 Sep."* The `Listing` stays `reserved` throughout.

3. The chosen reason + free text is shown to the seller (and staff). The pending window is
   deliberately a **chance for the seller and buyer to talk** (via Messages).

### 6.3 Resolution — one outcome only

The request **always ends in approval**. The only variable is *when*:

- **Seller approves** (seller center) — immediate.
- **Staff approve** (admin tool) — any time; and staff are the **only** actor for a seller
  with no login (`Seller.userId` is optional — #2).
- **Auto-approve** — **7 days after `CancellationRequest.createdAt`**, `resolvedBy = auto`.

There is **no reject** (it would only ever mean "keep persuading" — identical to doing
nothing, since the request auto-approves anyway) and the **buyer cannot withdraw** the
request. A buyer who changes their mind places a **new order** once the Listing is back to
`published` — and is advised on-screen to message the seller first.

On approval (any path):
- `Order.status → cancelled`; `lastReachedStatus` = the status held; `cancelledAt` set;
- `CancellationRequest.state → approved`; `resolvedAt`, `resolvedBy` set;
- `Listing` transitions `reserved → published` (re-listed, buyable again — locked in #8).

### 6.4 What a pending request blocks

- Staff **may** still advance `placed → confirmed` while a request is pending — it does not
  affect cancellability.
- Staff / seller **cannot** advance the order to `shipped` while a request is pending.
  Shipping an order the buyer is trying to cancel is exactly what the grace period exists to
  prevent. The request must resolve first (→ the order is cancelled) — in practice a pending
  request means the order will be cancelled.

### 6.5 The 7-day timer

- The deadline is `CancellationRequest.createdAt + 7 days`, stored as `autoApproveAt`.
- Mechanism: a **scheduled job (Vercel Cron, daily)** sweeps `pending` requests past their
  `autoApproveAt` and approves them. As a safety net, the order detail page and the admin
  list also **resolve an overdue request lazily on read**.
- Staff get a **"Pending cancellations"** list in the admin tool, showing each request's
  reason and `autoApproveAt`.
- *(Build note: the cron wiring is an implementation detail for the build effort; the rule is
  what this spec fixes.)*

---

## 7. The order detail page (buyer)

Reachable by the buyer who placed the order, only for their own orders. Shows:

- **Status tracker** — the four pipeline steps, with the **expected-time line** directly
  beneath the current step (§8); or, if cancelled, the pipeline "done" up to
  `lastReachedStatus` with a **Cancelled** marker below and the cancellation reason.
- **The item** — primary photo, title, condition, and key Part details, **read through to the
  retained Listing** (§10.3). The Listing is never deleted — it goes `sold` / `cancelled` and
  drops out of browse, but the buyer with an order still renders it from here. The Order
  snapshots only what can drift or must be preserved: `itemPriceEur` and the delivery address.
- **Shipping** — `shippingCostEur` + `shippingNotes` when set; order total.
- **Delivery address** — the Order snapshot.
- **Seller** — display name + Location city / country only (§11) — never the seller's full
  address.
- **Tracking number** — once `shipped`.
- **Actions**, contextual:
  - **Cancel order** — when `placed` / `confirmed` and no request is pending (§6);
  - **Confirm receipt** — when `shipped` (§Q7 → moves to `delivered`);
  - **Message seller** — always; opens or creates the buyer↔seller `Thread` for this Listing
    (the [messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11) owns the Thread).

**Placing an order does _not_ auto-create a `Thread`.** The buyer reaches messaging through the
explicit link above.

---

## 8. Expected-time display

Two layers, shown as a single line under the current status in the tracker:

1. **Static copy per status**, baked into the UI, always present:
   - `placed` — "The seller usually confirms within 1–2 days."
   - `confirmed` — "Being prepared for shipping."
   - `shipped` — "Typically arrives in 3–7 days." *(fallback, see layer 2)*
   - `delivered` — (no line)
2. **Staff free-text override at `shipped`** — the `expectedTimeRange` field the staff enter
   when marking the order shipped (e.g. *"Arriving 12–15 Sep"*). When set, it **replaces** the
   static `shipped` copy.

`expectedTimeRange` is a single nullable free-text column; it is only populated at the
`shipped` step in v1.

---

## 9. `delivered` (Q7)

- The order detail page shows a **Confirm receipt** button once the order is `shipped`.
  The buyer clicking it moves the order `shipped → delivered` (→ Listing `sold`).
- Staff can also **Mark delivered** in the admin tool (for an unresponsive buyer).
- There is **no automatic or timed** transition to `delivered`.

---

## 10. Entities

### Order (expanded)

| Field | Type | Notes |
|---|---|---|
| `internalCode` | string, unique | readable staff code, `ORD-000123` (cf. `PRT-` / `LST-`) |
| `buyerId` | FK → Buyer, required | |
| `sellerId` | FK → Seller, required | denormalised from the Listing (nearly every query is "orders by seller") |
| `listingId` | FK → Listing, required | the one purchased Listing |
| `itemPriceEur` | decimal, required | **snapshot** of `Listing.priceEur` at placement |
| `shippingCostEur` | decimal, nullable | staff-entered, display-only (§5) |
| `shippingNotes` | text, nullable | staff-entered (§5) |
| `status` | enum, required | `placed \| confirmed \| shipped \| delivered \| cancelled` |
| `lastReachedStatus` | enum, nullable | set only on cancellation (§3) |
| `expectedTimeRange` | text, nullable | staff free text, set at `shipped` (§8) |
| `trackingNumber` | text, nullable | staff free text, set at `shipped` |
| delivery-address snapshot | 7 columns / embedded value | `recipientName`, `phone`, `addressLine1`, `addressLine2?`, `city`, `postcode`, `country` (§4) |
| `placedAt` | timestamp, required | |
| `confirmedAt` `shippedAt` `deliveredAt` `cancelledAt` | timestamp, nullable | dedicated columns, one per transition — enough for the tracker; a full `OrderEvent` audit log is deferred (fog) |

Relationships: → 1 `Buyer`, → 1 `Seller`, → 1 `Listing`, → 0..1 `CancellationRequest`.

#### 10.3 Item display after the Listing is hidden

The `Listing` is never deleted — once the order completes it goes `sold` (or `cancelled`) and
drops out of the funnel / browse, but the row stays. The buyer's order detail page **reads
through** to it for the photo, title, condition, and Part details. The Order does **not**
snapshot the item's display fields; it snapshots only `itemPriceEur` (which could otherwise be
edited on a re-published Listing after a cancellation) and the delivery address. A future full
`OrderEvent` / snapshot model is fog.

### CancellationRequest (new)

| Field | Type | Notes |
|---|---|---|
| `orderId` | FK → Order, required | **0..1 per Order** — one request, one outcome |
| `requestedBy` | enum | `buyer \| staff` (staff can raise one on a seller's behalf) |
| `reason` | enum | see §6.2 table |
| `reasonDetail` | text, nullable | **required** when `reason = other` |
| `state` | enum | `pending \| approved` — no other terminal state |
| `createdAt` | timestamp, required | |
| `autoApproveAt` | timestamp, required | `createdAt + 7 days` |
| `resolvedAt` | timestamp, nullable | |
| `resolvedBy` | enum, nullable | `seller \| staff \| auto` |

Invariants (DAL, per #2's "behavioural invariants → the DAL" rule):
- a `CancellationRequest` may be created only while the Order is `placed` or `confirmed`;
- at most one `CancellationRequest` per Order;
- while a request is `pending`, the Order cannot transition to `shipped`;
- approving a request is the only way an Order reaches `cancelled`.

---

## 11. Visibility

| Viewer | Sees |
|---|---|
| **Staff** (admin tool) | everything — full delivery-address snapshot, buyer name + phone, every status/timestamp, the `CancellationRequest` + reason |
| **Seller** (seller center — screen owned by #13, data rule here) | full delivery-address snapshot + buyer phone (needed to ship), the item, status, tracking, the `CancellationRequest` + reason |
| **Buyer** (order detail page) | their own order only — seller **display name** + Location **city / country** (not the seller's full address), the status tracker, tracking number, shipping cost + total |
| any other buyer | nothing |

---

## 12. Downstream / fog touched by this ticket

- **Notifications** (map fog) — order-status-change and cancellation-request notifications
  (email vs in-app) are still unspecified; this ticket deliberately leaves them out.
- **Seller center (#13)** — consumes the `Order` and `CancellationRequest` here; owns the
  screen and metrics.
- **Messaging (#11)** — the "Message seller" link and the pending-cancellation conversation
  use its `Thread`.
- **Final spec assembly** (map fog) — the admin tool's Order Management screens; whether an
  ADR is warranted for the always-approves cancellation model.
