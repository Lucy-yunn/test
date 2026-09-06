# v1 Admin Tool

The staff back office. Every screen is `role = staff` only, English-only, under `/admin/*`,
gated by `requireStaff()` in the **DAL** (not in layouts —
[`auth-and-permissions.md`](../auth-and-permissions.md) §10).

This document defines **what each screen shows, what it does, and which rules it operates
within** — not pixel layout. Every rule below is already fixed by a closed ticket; the build
assembles CRUD over the entities.

**Admin scope (Q20):** Order Management + Product Management, plus the operational surfaces
that accreted — Sellers, Buyers, Vehicle catalogue, Cancellations, Threads. Nothing else:
no marketing / finance / CS / store-management / subscription modules, no ad analytics, no
staff-management UI, no impersonation.

There is **no staff-facing notification feed** — staff work entirely from the queues and lists
below ([`notifications.md`](../notifications.md) §4).

---

## 1. `/admin` — Dashboard

Three action queues, each a filtered list with a count:

| Queue | Contents | Links to |
|---|---|---|
| **Needs confirmation** | `Order.status = placed` | `/admin/orders/[code]` |
| **Pending cancellations** | `CancellationRequest.state = pending`, sorted by `autoApproveAt` ascending | `/admin/orders/[code]` (cancellation panel) |
| **Reported threads** | `Report` rows not yet resolved | `/admin/threads/[id]` |

No charts, no revenue, no time series.

---

## 2. `/admin/sellers`

**List** — every `Seller`: `displayName`, Location city, has-login flag, counts of active
listings / open orders.

**`/admin/sellers/new`** — Phase 1 provisioning ([`auth-and-permissions.md`](../auth-and-permissions.md) §4.1):
create the `Seller` profile — `displayName`, contact name / email / phone, embedded **Location**
(name, address line, city, postcode, country). **No `User` created.** The Seller can be given
`DonorVehicle`s and `Listing`s immediately.

**`/admin/sellers/[id]`** — profile + Location editor, listing/order/thread counts, and the
login controls:

| Action | Effect | Rule |
|---|---|---|
| **Provision login** | enter a login email (pre-filled from contact email). **Collision check** — reject if the email belongs to **any** `User`. On success: create `User{role:seller}`, link `Seller.userId`, **show a random initial password once** for staff to relay. Not force-rotated. | [`auth-and-permissions.md`](../auth-and-permissions.md) §4.2, [ADR-0004](../adr/0004-one-role-per-user.md) |
| **Disable / Enable login** | Better Auth ban toggle. Profile, listings, orders, messages untouched. | §4.3 |
| **Unlink login** | clear `Seller.userId` **and** disable that `User` (never hard-delete). Seller reverts to login-less (no messaging). | §4.3 |
| **Reset password** | new random password shown once to staff. Works on any `User`. | §4.3, §6 |

A disabled / unlinked seller behaves as **login-less** on the buyer site — no *Message seller*
button, no `Thread` ([ADR-0006](../adr/0006-both-sides-login-messaging.md)).

---

## 3. `/admin/buyers`

**List + `/admin/buyers/[id]`** — view a `Buyer` (name, email, delivery address, order count).
The only action is **Reset password** (§6, no self-serve reset). No buyer creation here —
buyers self-register.

---

## 4. `/admin/catalogue` — Vehicle catalogue

`VehicleMake → VehicleModelGroup → VehicleGeneration` ([ADR-0003](../adr/0003-provenance-first-generation-grain.md)).
The repo **seed fixture is the source of truth**; admin CRUD is minimal and exists mainly to
**add a `VehicleGeneration` during intake** when a donor vehicle is `— NOT LISTED —` on the
sheet ([`seller-intake.md`](../seller-intake.md) §2.4).

- `VehicleMake` — `name`, `slug`, `country`, `displayOrder`, `isActive`.
- `VehicleModelGroup` — `makeId`, `name` (e.g. `A4, S4`), `slug`, `displayOrder`, `isActive`.
- `VehicleGeneration` — `modelGroupId`, `label` (`A4 S4 B5 8D (1994–1999)`), `chassisCodes[]`,
  `productionStart/End`, `displayOrder`, `isActive`.
- `isActive = false` hides a row from the funnel without deleting rows that provenance points
  at.

**No `Fitment` anything** — the entity does not exist in v1.

---

## 5. `/admin/parts` — Parts & PartNumbers ([#5](https://github.com/Lucy-yunn/test/issues/5))

**List / search** — by `internalCode` (`PRT-000123`), name, or `PartNumber.normalized`.

**`/admin/parts/[code]`** — the Part detail page:
- `name`, `categoryId` (leaf), `attributes` (per-Category Zod-validated JSONB), `partStatus`
  (`provisional → confirmed`, staff-only, no going back), `pnStatus` (`unknown` / `unverified`
  / `verified`), `notes`.
- **`PartNumber` rows** — `raw` + `normalized`, `numberType` (`oem`/`aftermarket`/`casting`/
  `trade`/`other`), `brand` (free text), `isPrimary` (≤1), `verified`. Add / edit / remove.
  Cross-brand numbers join the **same** Part only after staff verify interchangeability.
- **De-dup** — creating a Part or adding a number searches `PartNumber.normalized` first and
  **offers existing Parts** before a new one is created. Never auto-merges.
- **Hard-merge** — staff merge two Parts with a **tombstone + audit log entry** (unlike the
  low-stakes reference data elsewhere). Supersession is deferred (`PartNumberLink` reserved).

**Listing intake reads/writes Parts** — see §7.

---

## 6. `/admin/donor-vehicles` + `/admin/listings` — Product Management (donor-first intake)

The core staff workflow ([`seller-intake.md`](../seller-intake.md), [ADR-0007](../adr/0007-staff-entry-no-submission-entity.md)).
Staff transcribe the returned intake sheet.

### 6.1 `/admin/donor-vehicles/[id]` — create the car once

Per `Vehicles` row on the sheet:
- `sellerId`, `generationId` (**required** — resolve `— NOT LISTED —` by adding a
  `VehicleGeneration` in §4), `label` (staff reference).
- Nullable: `donorYear`, `vin` (shown **masked** to buyers), `vinDerivedNotes` (staff-only),
  `mileageKm`, `registrationCountry`, `notes`.
- **Structured detail** (nullable, shown to buyers on the Listing): `engine`, `engineCode`,
  `fuel`, `transmission`, `bodyStyle`, `drivetrain`.
- `DonorVehiclePhoto` 0..n (optional).
- No lifecycle status — it is a data record.

### 6.2 `/admin/listings/new` (against a `DonorVehicle`) + `/admin/listings/[id]` — the editor

Per `Parts` row:
1. **Part** — match-or-create via §5 de-dup. The seller's free-text part name + visible codes
   drive the search.
2. **This item** — `condition` (`new` / `used_good` / `needs_repair`) + `conditionNotes`
   (seller's words, **as written**); `ListingDefect` rows (staff split the sheet's
   one-fault-per-line into rows, each with an optional photo link); `priceEur` **copied
   unchanged** from the sheet; `negotiable`; `sellerSku`, `warehouseLocation`, `removalNotes`;
   dimensions (`lengthCm` / `widthCm` / `heightCm` / `weightKg` / `packageSizeNotes`).
3. **Photos** — upload from the seller's folder, **downscale on ingest** (~2000 px longest
   edge), order (first = primary), soft cap ~15. Only these enter Vercel Blob.
4. **Publish checklist** — `draft → published` requires: ≥1 photo · `condition` set ·
   `priceEur > 0` · `Part` linked with a leaf `Category` · `DonorVehicle` linked · ≥1
   `PartNumber` **or** "no visible number" ticked. There is **no review state / approval
   queue** — the checklist is the gate.
5. **Status transitions** — `draft → published`; `published ↔ cancelled`;
   `published` / `cancelled → archived`. Staff **never** set `sold` by hand (an offline sale
   = cancel the order + note). `published → reserved → sold` is driven by the order lifecycle
   only.

**Build note:** the editor must not assume only staff create a `draft` — the future
self-serve path reuses `draft` + the checklist as its approval gate ([ADR-0007](../adr/0007-staff-entry-no-submission-entity.md)).

### 6.3 `/admin/listings` — list

All statuses, all sellers. Filter by status / seller / Category. Bulk actions are not
required for v1 volume.

---

## 7. `/admin/orders` — Order Management ([`order-model.md`](../order-model.md))

**List** — every `Order`. Filters over `status` (`placed` / `confirmed` / `shipped` /
`delivered` / `cancelled`) plus a **"needs confirmation"** shortcut (`status = placed`).
Newest first.

**`/admin/orders/[code]`** — full visibility (everything: delivery snapshot, buyer name +
phone, every timestamp, the `CancellationRequest` + reason). Transition controls:

| Action | From → To | Requires |
|---|---|---|
| **Confirm order** | `placed → confirmed` | allowed even with a pending cancellation; sets `confirmedAt`. Staff may now enter `shippingCostEur` + `shippingNotes` (display-only, nothing charged). |
| **Mark shipped** | `confirmed → shipped` | **no pending `CancellationRequest`**; staff enter `expectedTimeRange` **and** `trackingNumber` (both required); sets `shippedAt`. |
| **Mark delivered** | `shipped → delivered` | for an unresponsive buyer (the buyer can also self-confirm). Sets `deliveredAt`; `Listing → sold`. |

Each transition also writes the buyer/seller `Notification` rows in the same transaction
([`notifications.md`](../notifications.md) §3.1).

---

## 8. `/admin/cancellations` — Pending cancellations

List of `CancellationRequest.state = pending`, each with the `reason` (+ `reasonDetail`) and
`autoApproveAt`, sorted by `autoApproveAt`. Actions:

- **Approve** — any request, any time. Staff are the **sole** approver for a login-less
  seller's order. On approval: `Order → cancelled` (`lastReachedStatus` kept),
  `CancellationRequest → approved` (`resolvedBy = staff`), `Listing → published`.
- **Raise a cancellation** on a seller's behalf — `requestedBy = staff`, choose the reason.

**No reject, no decline** — [ADR-0005](../adr/0005-always-approves-cancellation.md). The daily
**Vercel Cron** sweep auto-approves anything past `autoApproveAt` (`resolvedBy = auto`);
overdue requests also resolve lazily on read of this list or the order page.

---

## 9. `/admin/threads` — Messaging moderation ([`messaging-model.md`](../messaging-model.md) §7)

**List** — every `Thread`, newest by `lastMessageAt`, flagging those with an open `Report`.
Unconditional read access — Threads are not private from the operator.

**`/admin/threads/[id]`** — the full message log + moderation controls:

| Action | Effect |
|---|---|
| **Post as "IVO Support"** | a `Message` with `senderRole = staff`, rendered to both parties as a distinct labelled entry — never as the seller. |
| **Lock / Unlock** | a locked Thread accepts no messages from buyer or seller; both see *"This conversation was closed by IVO."* Reversible. |
| **Resolve report** | clears the `Report` from the queue (`resolvedAt`, `resolvedBy`). |
| **Block a `User`** | sets `User.messagingBlockedAt` — that user cannot start or reply to any Thread anywhere; existing Threads become read-only for them. |

No message deletion or redaction — the log is append-only.

---

## 10. Authorization summary

| Rule | Where |
|---|---|
| Every `/admin/*` route + data function + Server Action | `requireStaff()` in the DAL |
| Wrong-role authenticated request (e.g. a buyer opens `/admin`) | plain **403 page** (not a redirect, not a 404) |
| Staff accounts | seed script only — **no creation UI here** |
| Impersonation | not built |
| Staff have **no** seller-center access | they see every seller's data here instead |
