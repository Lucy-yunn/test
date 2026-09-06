# v1 Domain Model — entities & relationships

Resolves [Core domain model — entities & relationships (#2)](https://github.com/Lucy-yunn/test/issues/2)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

This is the entity-relationship skeleton the remaining tickets build on. It defines *what the
entities are, what they hold at a conceptual level, and how they relate* — not table DDL,
column types, or lifecycle detail. Those belong to the downstream tickets listed at the end.

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md). Field lists here are conceptual;
where a ticket owns the full detail it is named inline.

---

## The four questions this ticket had to settle

### 1. Is Provenance its own entity or embedded fields on the Listing?

**Neither — Provenance is a relationship.** A **`DonorVehicle`** is a first-class entity: the
physical car a Seller dismantled. A **`Listing`** points at exactly one `DonorVehicle`
(`Listing.donorVehicleId`, required), and many Listings share one `DonorVehicle`. *Provenance*
is that `Listing → DonorVehicle` link. Anything specific to how this one part came off the car
(e.g. "removed with mounting bracket") is a nullable `removalNotes` field on the Listing.

Why not embedded fields (as the map's Q6 and this ticket originally framed it): staff intake
is donor-first — enter the car once, then add its parts — and dismantlers list dozens of parts
per car. Embedding would re-type VIN / mileage / engine code on every Listing.

### 2. How do Part↔Vehicle (fitment) and Listing↔Vehicle (provenance) both relate to one Vehicle entity?

Both resolve to **`Modification`**, the leaf of the `VehicleMake → VehicleModel →
Modification` catalogue.

- **Fitment** points at `Modification` **directly and per-Part**: a verified many-to-many join
  `Part ↔ Modification`.
- **Provenance** reaches `Modification` **indirectly and per-physical-car**:
  `Listing → DonorVehicle → Modification` (`DonorVehicle.modificationId` is **required** — see
  [Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8); there is no unknown-donor
  case, staff always identify the donor to a Modification, extending the hand-built catalogue
  during intake when needed).

One shared `Modification` entity, two independent paths to it. Fitment is never inferred from
Provenance.

### 3. Is User one entity with a role, or separate Buyer / Seller / Staff entities?

**Hybrid.**

- **`User`** — the single login identity for everyone, carrying `role`
  (`buyer` | `seller` | `staff`), exactly one per User in v1. Owned by Better Auth.
- **`Buyer`** — a profile entity, 1:1 with a `User`, **auto-created on self-registration**.
  Holds delivery address and contact details.
- **`Seller`** — a profile entity, **created by staff during onboarding**; its `User` link is
  1:1 and **optional**, attached when a seller-center login is provisioned. Holds business /
  display name, contact, and the single embedded Location.
- **Staff** — no profile entity; just `User.role = staff` (only the two founders, created by
  hand).

Sale-related entities (`Order`, `Favorite`, `Thread`, `Listing`, `DonorVehicle`) reference
`Buyer` / `Seller`, not `User`.

### 4. Where does the Category → Part → Listing hierarchy enforce its invariants?

- **Structural invariants → the Prisma schema / database.** "A Listing has a Part", "a Part
  has a Category", "a Part attaches only to a leaf" — the last is automatic because `Group`
  and `Category` are separate tables, so a `Part.categoryId` structurally *cannot* point at a
  `Group`. Enforced by FKs, required relations, and enums.
- **Behavioural invariants → the DAL service layer**, next to Better Auth authorization:
  `partStatus` transitions (`provisional → confirmed`, staff-only, no going back), intake
  de-duplication, staff merges, "cannot delete a Category that still has Parts", and
  `Listing.sellerId == DonorVehicle.sellerId`.
- **No** database triggers or check constraints beyond FK / enum / unique in v1.

---

## Entity catalogue

### People & access

#### User
The login identity for every person who can sign in. Owned by Better Auth.

- `email`, `passwordHash` (Better Auth), `name`
- `role` — `buyer` | `seller` | `staff`; exactly one in v1
- Relationships: 1:1 optional → `Buyer`; 1:1 optional → `Seller`. A `staff` User has neither.

Permission matrix and session detail: [Auth, roles & permissions (#12)](https://github.com/Lucy-yunn/test/issues/12).

#### Buyer
A party who browses and purchases. Created automatically when a person self-registers.

- `userId` — 1:1, required
- **saved delivery address** — `recipientName`, `phone`, `addressLine1`, `addressLine2?`,
  `city`, `postcode`, `country`; editable in buyer settings, snapshotted onto each `Order` at
  checkout (see [`docs/order-model.md`](./order-model.md))
- Relationships: → many `Order`, → many `Favorite`, → many `Thread`

#### Seller
A party whose parts are sold on the platform. Created by staff during onboarding.

- `userId` — 1:1, **optional** (attached when a login is provisioned)
- `displayName`, contact name / email / phone
- **Location** (embedded): name, address line, city, postcode, country — one per Seller in v1
- Relationships: → many `DonorVehicle`, → many `Listing`, → many `Order` (as seller),
  → many `Thread` (as seller)

Seller-center scope and metrics: [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13).

### Catalogue

#### Group
A display-only cluster of Categories — the funnel's final-step headings. ~13 rows, frozen.

- `name`, `slug` (immutable), `displayOrder`
- Relationships: → many `Category`. **Never referenced by `Part`.**

#### Category
A selectable leaf part type. Plus one "Other / not listed" catch-all.

- `groupId` — required
- `name` (en-GB, sentence case, singular, no side/brand/vehicle), `slug` (immutable kebab-case)
- `synonyms[]` — captured from day one
- `tecdocGenericArticleIds[]` — nullable, reserved for a later parts-catalogue integration
- `displayOrder`, `isActive`
- Relationships: → many `Part`

Exact leaf list is finalised with the seed-data plan (see map). Full taxonomy rules:
[v1 category taxonomy (#3)](https://github.com/Lucy-yunn/test/issues/3).

#### Part
The platform's canonical technical identity of a component. One Part, many Listings.

- `id` — opaque surrogate; **never** an OEM part number
- `internalCode` — readable staff code, e.g. `PRT-000123`, unique
- `categoryId` — required (always a leaf)
- `name` — staff-authored label
- `attributes` — validated JSONB, keyed by Category, with a per-Category Zod schema;
  a high-value attribute can be promoted to an indexed column later
- `partStatus` — `provisional` (created at intake) | `confirmed` (staff-verified)
- `pnStatus` — `unknown` | `unverified` | `verified` (summary of its PartNumbers)
- `notes`, `createdBy`
- Relationships: → many `PartNumber`, → many `Fitment`, → many `Listing`

Merge semantics, de-dup workflow, supersession (deferred):
[Part identity & OEM part-number model (#5)](https://github.com/Lucy-yunn/test/issues/5).

#### PartNumber
One number a Part is known by. A Part has 0..n; zero is valid.

- `partId` — required
- `raw`, `normalized` (separators stripped, indexed — the match key)
- `numberType` — `oem` | `aftermarket` | `casting` | `trade` | `other`
- `brand` — free-form string, nullable, **not** an FK
- `isPrimary` — at most one true per Part
- `verified` — staff physically read it or confirmed it in a catalogue
- `note`, `createdBy`

Cross-brand numbers join the same Part **only after staff verify interchangeability**.

### Vehicles

Hand-built catalogue; only Modifications matching pilot sellers' real donor vehicles. Stored
as a repo seed fixture; admin CRUD deferred. Detail:
[Vehicle reference data strategy (#4)](https://github.com/Lucy-yunn/test/issues/4).

#### VehicleMake
- `name`, `slug`, `country` (nullable, display), `displayOrder`, `isActive`
- Relationships: → many `VehicleModel`

#### VehicleModel
- `makeId` — required
- `name`, `slug`, `displayOrder`, `isActive`
- Relationships: → many `Modification`

#### Modification
A specific engine/body variant — the vehicle-catalogue leaf and the funnel's third step.

- `modelId` — required
- `label` — e.g. "1.6 TDI (CLHA) 105hp estate"
- `engine`, `engineCode`, `fuel`, `powerKw`, `powerHp`, `bodyStyle`
- `productionStart`, `productionEnd` (nullable = current)
- `generationLabel` — nullable (folded in from the research doc's separate Generation level)
- `displayOrder`, `isActive`
- Relationships: → many `Fitment`, → many `DonorVehicle`

#### Fitment
The verified compatibility link. Lives conceptually on the Part.

- `partId`, `modificationId` — unique together
- `note` — nullable free text ("petrol only", "pre-facelift")
- `verifiedBy` (staff User), `verifiedAt`
- **Grain: Modification only.** A Part fitting a whole model = one Fitment row per
  Modification. The "fits the whole model" shortcut is a staff-UI concern, not a model change.

Staff entry workflow and how buyer search combines Fitment + Provenance:
[Fitment model & staff-entry workflow (#7)](https://github.com/Lucy-yunn/test/issues/7).

### Selling & buying

#### DonorVehicle
The physical car a Seller dismantled. Entered once by staff; parts added against it. Full
model resolved by [Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8).

- `sellerId` — required
- `modificationId` — **required** (no unknown-donor case; catalogue is extended during intake)
- `label` — required, staff reference ("Silver Golf VII, Plovdiv yard")
- `donorYear`, `vin`, `vinDerivedNotes`, `mileageKm`, `engineCode`, `transmission`
  (`manual`/`automatic`/`other`), `registrationCountry`, `notes` — all nullable
- `createdBy`
- **No lifecycle status in v1** — it is a data record
- `vin` is shown to buyers **masked**; `vinDerivedNotes` is staff-only
- Relationships: → many `Listing`, → many `DonorVehiclePhoto` (0..n, optional)

#### Listing
One physical used item one Seller has for sale. A single unique unit. Full model resolved by
[Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8).

- `internalCode` — readable, e.g. `LST-000123`, unique
- `partId` — required (Part must have a leaf `Category`)
- `sellerId` — required; invariant `== donorVehicle.sellerId` (DAL-enforced)
- `donorVehicleId` — required (this link *is* Provenance)
- `priceEur` — required; `negotiable` (bool)
- `condition` — `new` | `used_good` | `needs_repair`; `conditionNotes`
- `removalNotes` — nullable, part-specific provenance detail
- `sellerSku`, `warehouseLocation` — nullable
- `lengthCm`, `widthCm`, `heightCm`, `weightKg`, `packageSizeNotes` — nullable (shipping;
  [Order model (#10)](https://github.com/Lucy-yunn/test/issues/10) consumes these)
- `status` — `draft` | `published` | `reserved` | `sold` | `cancelled` | `archived`
- `publishedAt`, `reviewedBy` (nullable), `createdBy`
- Title is auto-composed for display, not stored
- Relationships: → many `ListingPhoto`, → many `ListingDefect`, → many `Favorite`,
  → many `Thread`, → 0..1 `Order` (active)

**Lifecycle:** `draft → published` (staff, passes the publish checklist);
`published → reserved` (order `placed`); `reserved → sold` (order `delivered`);
`reserved → published` (order cancelled before `shipped`); `published ↔ cancelled` (staff);
`published`/`cancelled → archived` (staff). Staff never set `sold` by hand. Only `published`
and `reserved` are buyer-visible.

#### ListingPhoto
- `listingId` — required
- `url` + metadata only (Vercel Blob behind the storage abstraction)
- `displayOrder` (first = primary), `caption` (nullable)
- **≥ 1 required to publish**; soft cap ~15

#### ListingDefect
A single known defect, entered separately (transparency — buyer sees a bulleted list).

- `listingId` — required
- `description` — required
- `photoId` — nullable, points at one `ListingPhoto`
- `displayOrder`

#### Order
A Buyer's purchase of exactly one Listing. **No cart, no line items, no `OrderItem`** in v1.
Full model, lifecycle, checkout + cancellation flows: [`docs/order-model.md`](./order-model.md)
(resolves [#10](https://github.com/Lucy-yunn/test/issues/10)).

- `internalCode` — readable, e.g. `ORD-000123`, unique
- `buyerId`, `sellerId` (denormalised from the Listing), `listingId` — required
- `itemPriceEur` — snapshot of `Listing.priceEur` at placement
- `shippingCostEur`, `shippingNotes` — nullable; staff-entered in the admin tool, display-only
  (checkout is stubbed, nothing is charged)
- `status` — `placed` | `confirmed` | `shipped` | `delivered` | `cancelled`
- `lastReachedStatus` — set only on cancellation; preserved above `cancelled` in the UI (Q17)
- `expectedTimeRange` (free text, nullable — set at `shipped`), `trackingNumber` (free text,
  nullable — set at `shipped`)
- delivery-address snapshot — `recipientName`, `phone`, `addressLine1`, `addressLine2?`,
  `city`, `postcode`, `country` (a flat group / embedded value, never an FK to a mutable row)
- `placedAt`, and per-transition timestamps (`confirmedAt` / `shippedAt` / `deliveredAt` /
  `cancelledAt`)
- Stubbed checkout — "Buy" creates the Order in `placed`, no payment, no staff approval gate;
  the Listing transitions `published → reserved`
- Relationships: → 1 `Buyer`, → 1 `Seller`, → 1 `Listing`, → 0..1 `CancellationRequest`

**Lifecycle:** `placed → confirmed → shipped → delivered`, plus `cancelled` from `placed` or
`confirmed` only (pre-ship). All transitions manual (no carrier integration). `delivered` and
`cancelled` are terminal. Listing coupling (locked in #8): `placed` → Listing `reserved`;
`delivered` → Listing `sold`; cancellation approved → Listing back to `published`.

#### CancellationRequest
A Buyer's request to cancel an Order before it ships. One-way: it always ends in `approved` —
the only variable is when (seller approves, staff approve, or auto-approve **7 days** after
`createdAt`). No reject; the buyer cannot withdraw. Full rules: [`docs/order-model.md`](./order-model.md).

- `orderId` — required; **0..1 per Order**
- `requestedBy` — `buyer` | `staff`
- `reason` — enum (`found_elsewhere` | `no_longer_needed` | `seller_too_slow` |
  `condition_or_fitment_concern` | `ordered_by_mistake` | `other`)
- `reasonDetail` — nullable free text; required when `reason = other`
- `state` — `pending` | `approved`
- `createdAt`, `autoApproveAt` (`createdAt + 7 days`), `resolvedAt` (nullable),
  `resolvedBy` (nullable — `seller` | `staff` | `auto`)
- While a request is `pending` the Order may still go `placed → confirmed` but **cannot** go
  to `shipped`.

#### Favorite
- `buyerId`, `listingId` — unique together
- `createdAt`

#### Thread
A single buyer↔seller conversation, scoped to one Listing and one Buyer.

- `listingId`, `buyerId`, `sellerId` — required; unique `(listingId, buyerId)`
- `createdAt`, `lastMessageAt`
- Relationships: → many `Message`

#### Message
- `threadId` — required
- `senderUserId` (or sender role + id) — resolved in [In-app messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11)
- `body`, `sentAt`, `readAt` (nullable)

Thread scoping, notifications, moderation: [In-app messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11).

---

## Relationship diagram

```mermaid
erDiagram
    User ||--o| Buyer : "is"
    User ||--o| Seller : "is"

    Seller ||--o{ DonorVehicle : owns
    Seller ||--o{ Listing : sells

    Group ||--o{ Category : contains
    Category ||--o{ Part : classifies

    Part ||--o{ PartNumber : "known by"
    Part ||--o{ Fitment : "fits via"
    Part ||--o{ Listing : "realised as"

    VehicleMake ||--o{ VehicleModel : has
    VehicleModel ||--o{ Modification : has
    Modification ||--o{ Fitment : "compatible in"
    Modification ||--o{ DonorVehicle : "identified as"

    DonorVehicle ||--o{ Listing : "provenance of"
    DonorVehicle ||--o{ DonorVehiclePhoto : shows
    Listing ||--o{ ListingPhoto : shows
    Listing ||--o{ ListingDefect : discloses
    Listing ||--o{ Favorite : "saved as"
    Listing ||--o{ Thread : "discussed in"
    Listing ||--o| Order : "sold via"

    Buyer ||--o{ Order : places
    Buyer ||--o{ Favorite : saves
    Buyer ||--o{ Thread : starts
    Seller ||--o{ Order : fulfils
    Seller ||--o{ Thread : answers

    Order ||--o| CancellationRequest : "cancelled via"

    Thread ||--o{ Message : contains
```

---

## Decisions & rationale (the non-obvious calls)

| Decision | Why | Alternative rejected |
|---|---|---|
| **`DonorVehicle` is its own entity; Provenance is the `Listing → DonorVehicle` link** | Donor-first staff intake; many parts per car; donor data typed once | Embedded provenance fields on Listing (re-typing per part) |
| **`User` + separate `Buyer` / `Seller` profile entities** | Buyer self-registers, Seller is staff-created with an optional login; each profile is a clean home for role-specific data | Single `User.role` with no profiles (no home for delivery address / Location / business identity); fully separate tables with no shared login (Better Auth wants one `User`) |
| **Staff has no profile entity** | Only two people, no domain data beyond the role | A `Staff` table for symmetry (empty) |
| **`Group` is a table, not a label on `Category`** | Funnel menu needs stable ordering + slugs; makes leaf-only structural | `group` enum/string on Category |
| **Fitment grain = `Modification` only** | Trivial, unambiguous fitment resolution; matches the hand-built catalogue | Model-level or year-range Fitment rows (ambiguous unions) |
| **No cart / `OrderItem` in v1** | Every part is a unique single unit; multi-seller carts split into N orders anyway; checkout is stubbed so one-payment-many-items has no value yet | Cart + `Order → OrderItem` split now |
| **`Listing.sellerId` kept explicit** (redundant with `donorVehicle.sellerId`) | Nearly every query is "listings/orders by seller"; invariant enforced in the DAL | Derive seller through the DonorVehicle on every query |
| **`DonorVehicle.modificationId` required** (reverses the "unknown donor allowed" note from #2) | Provenance stays meaningful; enables "parts from this exact car"; the hand-built catalogue already only holds real pilot-donor Modifications, so staff extend it during intake | Nullable modification — but a numberless *and* variant-less part is barely identifiable |
| **A Part with no `PartNumber` can still be published** (checklist takes "no visible number" tick) | #5's researched position — used-yard parts routinely lack legible numbers; fit-confidence comes from `Fitment`, not the number; a *wrong* forced number generates disputes | Hard-require a number — blocks legitimate parts, slows intake, risks bad data |
| **`Listing.status` merges pipeline + stock state; `sold` only at order `delivered`** | One enum, no ambiguity; `reserved` holds the item for the whole order, released on pre-`shipped` cancel | Separate `stockStatus` field; `sold` at `confirmed` |
| **`sold`/`cancelled`/`archived` listings are fully hidden from buyers** | Keeps the marketplace showing only actionable stock; a completed sale is back-office data | Show sold listings greyed (clutters browse) |

An ADR for the `DonorVehicle` / Provenance decision (hard to reverse, surprising against the
map's Q6, a real trade-off) should be extracted when the "Final spec assembly" ticket decides
the deliverable's ADR structure.

---

## What each downstream ticket now owns

| Ticket | Owns |
|---|---|
| [Fitment model & staff-entry workflow (#7)](https://github.com/Lucy-yunn/test/issues/7) | `Fitment` verification status, the staff entry workflow, how buyer search unions Fitment + Provenance |
| [Listing model (#8)](https://github.com/Lucy-yunn/test/issues/8) | ✅ **Resolved** — `Listing` / `DonorVehicle` / `ListingPhoto` / `ListingDefect` above; lifecycle, publish checklist, buyer visibility. Seller-facing intake spun off to its own ticket. |
| [Buyer funnel search UX (#9)](https://github.com/Lucy-yunn/test/issues/9) | How a non-expert buyer picks a `Modification` with no year step; the `Modification → Group → Category` tail |
| [Order model & stubbed checkout (#10)](https://github.com/Lucy-yunn/test/issues/10) | ✅ **Resolved** — `Order` + `CancellationRequest` above; full lifecycle, checkout flow, cancellation flow, shipping, visibility in [`docs/order-model.md`](./order-model.md) |
| [In-app messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11) | `Message.sender` representation, notifications, moderation |
| [Auth, roles & permissions (#12)](https://github.com/Lucy-yunn/test/issues/12) | The full permission matrix, seller account provisioning, buyer self-registration flow, the one-role-per-person rule |
| [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13) | Which screens and metrics the read-only seller center shows, how they are computed |
