# v1 Seller Credits

Added 2026-09-19 by the founders' v1 scope revision. Decision record:
[ADR-0010](./adr/0010-prepaid-seller-credits.md).

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md). The roles are **buyer**, **seller**,
**staff**. Credits are how the platform earns money in v1. A **seller** buys them from the
founders in advance; **publishing a Listing costs one credit**.

Money flows **seller to platform only**. Buyers pay the seller directly, off-platform
([`order-model.md`](./order-model.md)), so there is no split and no settlement.

---

## 1. Bundles

A **credit bundle** is a product the founders sell: a name, a number of credits, and a price in EUR.
Bigger bundles are cheaper per credit. Bundles are **data, edited by staff**, not code.

| Field | Notes |
|---|---|
| `name` | e.g. "Starter 50" |
| `credits` | positive integer |
| `priceEur` | decimal |
| `isActive` | inactive bundles cannot be selected for new top-ups, existing ledger entries are unaffected |
| `displayOrder` | |

Seed data ships **placeholder** bundles (for example 25, 100 and 250 credits at falling per-credit
prices). The real prices are a founder decision before launch.

---

## 2. Ledger

Every credit change is one row in an **append-only ledger**. The balance is the sum of `delta`.
Rows are never edited or deleted; a mistake is corrected with a compensating `adjustment`.

### CreditLedgerEntry

| Field | Type | Notes |
|---|---|---|
| `sellerId` | FK → Seller, required | |
| `delta` | int, required | positive for credit in, negative for credit out |
| `kind` | enum, required | `topup \| publish \| adjustment` |
| `bundleId` | FK, nullable | set for `topup` |
| `listingId` | FK, nullable | set for `publish` |
| `note` | text, nullable | **required** for `adjustment` |
| `createdBy` | FK → User, nullable | the staff member for `topup` and `adjustment`; the acting user for `publish` |
| `createdAt` | timestamp, required | |

The build may keep a cached `Seller.creditBalance`, updated in the same transaction as each
ledger row. The ledger stays the source of truth.

---

## 3. Spending a credit

**One credit is charged each time a Listing moves to `published` from `draft` or `cancelled`.**
The charge and the status change happen in one transaction; if the balance is below one, the
transition is refused and staff see *"This seller has no credits."* The publish checklist
([`spec/admin-tool.md`](./spec/admin-tool.md) §6.2) is unchanged.

Not charged:
- `reserved → published` (an order was cancelled or refused). The Listing was already paid for.
- Any status change other than into `published`.

**No refunds.** A cancelled, archived or sold Listing does not return its credit.
`archived` is terminal, so relisting an archived item means creating a new Listing, which costs
a credit again. Staff can correct a genuine mistake with a manual adjustment.

Staff publish on the seller's behalf (Listings are staff-entered), so the seller's balance is
what is charged.

---

## 4. Topping up and adjusting (staff only, manual)

A **seller** pays the founders outside the platform. **Staff** then, on the seller's admin page:
- **Add a bundle** — choose a bundle; a `topup` entry for its `credits` is written.
- **Adjust** — enter a positive or negative amount and a required note; an `adjustment` entry is
  written.

Two build decisions the spec left open: an adjustment that would take the balance below zero is
refused, and an inactive bundle cannot be chosen for a top-up. Staff manage the bundles on
`/admin/credits`, and add credits and see the ledger on each seller's admin page.

No payment provider is integrated in v1. Seller-initiated online top-up is a later layer that
writes the same ledger entries.

---

## 5. What sellers see

The seller center has a **Credits** section: current balance, and the ledger newest first with
kind, amount, note and date. There is no button to buy credits; the page says **"To add credits,
contact IVO."**

A **low-credit** notice (5 or fewer) and an **out of credits** notice are raised as in-app
notifications ([`notifications.md`](./notifications.md)).

---

## 6. Open items for launch

Not v1 build work, but unresolved: real bundle prices, whether prices include VAT, and how the
founders invoice a bundle sale.
