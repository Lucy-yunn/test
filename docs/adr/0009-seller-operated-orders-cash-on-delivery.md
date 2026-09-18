# ADR-0009 — Orders are operated by the seller; payment is cash on delivery outside the platform

- **Status:** accepted
- **Date:** 2026-09-19
- **Source:** founders' v1 scope revision (2026-09-10, grilled 2026-09-19) · full rules in [`docs/order-model.md`](../order-model.md)
- **Amends:** the order lifecycle and staff role decided in [#10](https://github.com/Lucy-yunn/test/issues/10); [ADR-0005](./0005-always-approves-cancellation.md) (cancellation)

## Context

v1 is Bulgaria-only, and local couriers deliver on an "inspect, then pay" basis. The buyer pays the seller's price and the courier fee to the courier on handover, so the platform touches no money and needs no shipping, tracking or receipt-confirmation flow. The original model had **staff** advance every order (`confirmed`, `shipped`, `delivered`) because sellers were assumed to be login-less. The two founders also cannot know whether a part is still on a seller's shelf or whether a parcel was handed over, so any status they set would be a guess.

## Decision

- **Lifecycle:** `placed → confirmed → completed`, plus terminal `cancelled` and `refused`. `refused` means the buyer inspected the part at the courier and declined it.
- **Only the seller** confirms, completes, or refuses an order. **Staff have no order actions** — a read-only list only. The buyer can cancel.
- `Listing` becomes `sold` only when the order is `completed`. `cancelled` and `refused` return the Listing to `published`.
- **No timers on stuck orders.** A seller who never responds leaves the Listing `reserved`; only the buyer cancelling releases it. Staff see the age of every open order and contact the seller themselves.
- **Every seller must have a login** (a Listing cannot be published without one). Login-less sellers are no longer a supported case.
- All shipping fields are removed: `shippingCostEur`, `shippingNotes`, `expectedTimeRange`, `trackingNumber`, the buyer "Confirm receipt" action, and the `shipped`/`delivered` states. The delivery-address snapshot stays because the seller needs it to book the courier.

## Consequences

**Positive**
- The platform never asserts a physical fact it cannot observe. Every status is set by the party who can see it.
- Large simplification: no carrier data, no expected-time copy, no receipt flow, fewer notifications.

**Negative / trade-offs**
- A silent seller can hold a Listing hostage indefinitely, and a buyer has no recourse except cancelling. Accepted because sellers are personally known to the founders; revisit with a timeout if it happens in practice.
- Sellers must use the system to sell at all. The seller center is no longer read-only.
- `completed` is set by the seller, so a seller can delay it. This weakens "verified purchase" reviews slightly ([ADR-0012](./0012-reviews-open-to-any-buyer.md)).
- Real payments later will need a fresh model.

## Alternatives considered

- **Staff advance the order on the seller's behalf** — rejected: staff cannot verify the facts.
- **Buyer confirms completion** — rejected by the founders for v1; may return as a fallback.
- **Auto-cancel unconfirmed orders after N days** — rejected for v1; the founders prefer visibility over automation.
