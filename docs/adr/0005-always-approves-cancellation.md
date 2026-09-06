# ADR-0005 — Cancellation always ends in approval; the buyer cannot withdraw

- **Status:** accepted
- **Date:** 2026-09-06
- **Source:** [#10 Order model & stubbed checkout](https://github.com/Lucy-yunn/test/issues/10) §6 · full flow in [`docs/order-model.md`](../order-model.md)

## Context

v1 has **pre-ship cancellation only** — no returns/refunds flow (map *Out of scope*). Checkout is stubbed: nothing is paid, so a cancellation moves no money. The question was how a cancellation resolves: can the seller reject it? can the buyer take it back? what if nobody acts?

An early grilling pass had "buyer can withdraw / seller can reject". That was revised.

## Decision

**A `CancellationRequest` is one-way: it always ends in `approved`. The only variable is when.**

- The buyer raises a request (pre-ship: order `placed` or `confirmed`) with a **reason** (enum + free text for `other`). The order status does **not** change; a banner shows on both sides with the `autoApproveAt` date. The `Listing` stays `reserved`.
- Resolution paths, all → `approved`:
  - **Seller approves** (seller center) — immediate.
  - **Staff approve** (admin tool) — any time; and staff are the **sole** actor for a login-less seller.
  - **Auto-approve** — **7 days** after `createdAt`, `resolvedBy = auto` (Vercel Cron daily sweep + lazy-on-read backstop).
- **No reject** — it would only ever mean "keep persuading", which is identical to doing nothing (the request auto-approves regardless).
- **No buyer withdrawal** — a buyer who changes their mind places a **new order** once the Listing is back to `published`, and is advised on-screen to message the seller first.
- A pending request **blocks `→ shipped`** but not `→ confirmed`. On approval: `Order → cancelled` (`lastReachedStatus` kept), `CancellationRequest → approved`, `Listing → published`.
- The pending window is deliberately a **conversation window** — seller and buyer are pointed at Messages.

## Consequences

**Positive**
- The state machine has one terminal cancellation outcome — no "rejected", no "withdrawn", no dispute state. `CancellationRequest.state` is `pending | approved`, nothing else.
- A buyer trying to cancel is never trapped by an unresponsive seller (the 7-day timer) or by a seller who says no (there is no no).
- Shipping an order the buyer is cancelling is structurally prevented.

**Negative / trade-offs**
- A seller cannot contest a cancellation they believe is unfair — their only lever is to talk the buyer out of it during the pending window. Acceptable in v1 because no money moves and the seller loses nothing but the reservation.
- "Changed my mind" costs the buyer a re-order rather than a one-click undo.
- With real payments, this model needs revisiting (a refund has to be initiated, and "always approve" interacts with fraud) — hence this ADR.

## Alternatives considered

- **Seller/staff can reject** — rejected: functionally equivalent to inaction given auto-approve, and adds a dispute surface with nothing behind it.
- **Instant buyer self-cancel** (no request, no window) — rejected: removes the seller's chance to save the sale and to flag a problem, and reads badly once real fulfilment exists.
- **Buyer can withdraw the request** — rejected: adds a race (withdraw vs auto-approve vs seller-approve) for a case cleanly handled by "place a new order".
