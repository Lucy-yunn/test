# v1 Build-Ready Specification — Used Auto Parts Marketplace

This is the **front door** for the build effort. It synthesises the design and points at the
authoritative source for each area. It does **not** restate those sources — where this
document and a topic doc disagree, the **topic doc wins**.

- Charted on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1). Every design
  decision is a closed child ticket (#2–#23); this document (#26) assembles them.
- The **Q1–Q29 product grilling record** is the first comment on the map — read it for the
  "why" behind the framing below.
- Glossary: [`../../CONTEXT.md`](../../CONTEXT.md). Entity model: [`../domain-model.md`](../domain-model.md).
- Screen inventory: [`./screens.md`](./screens.md). Admin tool: [`./admin-tool.md`](./admin-tool.md).
- Architecture & cross-cutting decisions: [`../adr/`](../adr/).

---

## 1. What v1 is

A **Part-centric marketplace for used automotive parts**. Bulgaria-based operation, English UI
with a language toggle scaffolded from day one (Bulgarian and other EU locales later). EUR only.

| Framing | Detail |
|---|---|
| **Demo first** (Q3) | A functional demo with **seed data and fictional buyers/sellers**. No real transactions. |
| **White-glove** (Q4) | The two founders personally onboard each seller. Fewer sellers, higher trust. |
| **Staff-entry** (Q10) | Staff create and maintain **every** `Listing`. There is no self-serve seller listing UI. See [ADR-0007](../adr/0007-staff-entry-no-submission-entity.md). |
| **Stubbed checkout** (Q11) | "Buy" creates an `Order`; no payment, escrow, or settlement. |
| **Provenance-first** ([#21](https://github.com/Lucy-yunn/test/issues/21)) | Parts are found by the car they were removed from. The platform makes **no verified cross-vehicle compatibility claim**. See [ADR-0003](../adr/0003-provenance-first-generation-grain.md). |
| **Social login** (Q21) | Google / Facebook buttons rendered **disabled**. |

**Three roles**, exactly one per `User` ([ADR-0004](../adr/0004-one-role-per-user.md)):
**buyer** (self-registers), **seller** (staff-created profile; a login is provisioned later or
never), **staff** (seed script; the two founders).

---

## 2. The domain model at a glance

Full model + ER diagram: [`../domain-model.md`](../domain-model.md). The spine:

```
Make ─▶ Model ─▶ Generation ─▶ Category ─▶ Part ─▶ Listing
      (VehicleModelGroup)   (leaf, +Group heading)       │
                                                         └─▶ DonorVehicle ─▶ Generation
```

- **Catalogue:** `VehicleMake → VehicleModelGroup → VehicleGeneration` (buyer labels:
  Make → Model → Generation; `Model` values may be grouped names like `A4, S4`). `Group`
  (~13 frozen) is a display heading over selectable leaf `Category` rows.
- **`Part`** = the canonical technical identity of a component (opaque id + `PRT-000123`
  code; 0..n `PartNumber`s; per-Category `attributes` JSONB). One Part → many `Listing`s.
- **`Listing`** = one physical used item one Seller has for sale — tied to one `Part` and one
  `DonorVehicle`. Single unit, `status` enum `draft|published|reserved|sold|cancelled|archived`.
- **Provenance** = the `Listing → DonorVehicle` link ([ADR-0002](../adr/0002-donorvehicle-provenance-as-relationship.md)).
  `DonorVehicle` (the physical car, one per dismantle, many Listings) carries `generationId`
  plus the structured `engine`/`engineCode`/`fuel`/`transmission`/`bodyStyle`/`drivetrain`
  shown to buyers. **There is no `Fitment` entity.**
- **Party:** `User` (Better Auth, carries `role`) + optional `Buyer` / `Seller` profiles.
- **Sale:** `Order` (one Listing, no cart), `CancellationRequest` (0..1 per Order),
  `Favorite`, `Thread` + `Message` + `Report`, `Notification`.

**Invariants:** structural ones (has-a, leaf-only) in the Prisma schema; behavioural ones
(status transitions, de-dup, merges, `Listing.sellerId == DonorVehicle.sellerId`, messaging
block) in the DAL. No DB triggers.

---

## 3. The four surfaces

Full route-by-route inventory: [`./screens.md`](./screens.md).

| Surface | Routes | Audience | Owning docs |
|---|---|---|---|
| **Buyer site** | `/` , `/browse` , `/listing/[id]` , `/login` , `/register` , policy pages | anonymous + all roles (buy/favourite/message are buyer-only) | [`buyer-funnel-search.md`](../buyer-funnel-search.md), [`donor-vehicle-parts.md`](../donor-vehicle-parts.md) |
| **Buyer account** | `/account/*` — orders, favourites, messages, settings, activity | `buyer` | [`order-model.md`](../order-model.md), [`messaging-model.md`](../messaging-model.md), [`notifications.md`](../notifications.md), [`seller-center.md`](../seller-center.md) §10 |
| **Seller center** | `/seller/*` — overview, orders, listings, messages, store, notifications | `seller` **with a login** | [`seller-center.md`](../seller-center.md) |
| **Admin tool** | `/admin/*` — the whole back office | `staff` | [`./admin-tool.md`](./admin-tool.md) + the data rules in [#5](https://github.com/Lucy-yunn/test/issues/5)/[#8](https://github.com/Lucy-yunn/test/issues/8)/[#10](https://github.com/Lucy-yunn/test/issues/10)/[#11](https://github.com/Lucy-yunn/test/issues/11)/[#12](https://github.com/Lucy-yunn/test/issues/12) |

Everything is under `app/[locale]/…`; the admin tool is English-only but still routed under
`[locale]` for uniformity.

**Enforcement** ([`auth-and-permissions.md`](../auth-and-permissions.md) §10): `proxy.ts` does an
optimistic cookie-only redirect (**not** a security boundary); the **DAL is the real gate** —
`verifySession()` + `requireBuyer/Seller/Staff()` in every data function *and* every Server
Action, plus ownership checks. Wrong-role authenticated request → a plain **403 page**.

---

## 4. End-to-end flows

### 4.1 Buyer: find → buy → receive
1. **Funnel** on the homepage: `Make → Model → Generation → Part category`. Generation is
   optional (skipping widens to all Generations of the Model). → [`buyer-funnel-search.md`](../buyer-funnel-search.md) §1.
2. **Browse** results: provenance match (`donorVehicle.generationId == chosen`), newest first,
   **no fit badges**; each row shows the `Taken from:` line + donor engine/gearbox detail +
   a standing "same-generation ≠ guaranteed fit" note. Facets: Category / Generation / Engine
   / Fuel / Gearbox / Quality / Price. → §2–4.
3. **Listing detail**: photos, Part + `PartNumber`s, provenance, `ListingDefect` bullets,
   price, **"More parts from the same car"** ([`donor-vehicle-parts.md`](../donor-vehicle-parts.md)),
   and **Buy** / **Favorite** / **Message seller** (buyer-only; Message needs the seller to
   have a login).
4. **Buy** → a lightweight checkout confirmation page (item, saved delivery address with
   Edit, shipping "arranged after purchase") → **Place order**: `Order` created `placed`,
   `itemPriceEur` + address snapshotted, `Listing → reserved`. → [`order-model.md`](../order-model.md) §2.
5. **Order lifecycle** `placed → confirmed → shipped → delivered`, all advanced **manually by
   staff** except the buyer's **Confirm receipt** (`shipped → delivered`). The buyer tracker
   shows an expected-time line under the current step. → §3, §7–9.
6. Each transition writes a **`Notification`** row to the buyer's feed (in-app; no email). → [`notifications.md`](../notifications.md) §3.1.

### 4.2 Staff: intake → publish
1. Seller returns the **intake sheet** + a photo folder to a shared drive. → [`seller-intake.md`](../seller-intake.md), [ADR-0007](../adr/0007-staff-entry-no-submission-entity.md).
2. Staff transcribe in the admin tool: for each `Vehicles` row → a `DonorVehicle` (resolve
   `— NOT LISTED —` by adding a `VehicleGeneration`); for each `Parts` row → match-or-create
   the `Part` (de-dup on `PartNumber.normalized`), create the `Listing` against the right
   `DonorVehicle`, copy the seller's price **unchanged**, split defects into `ListingDefect`
   rows, select/downscale/upload photos.
3. Run the **publish checklist** (≥1 photo · condition · price>0 · Part w/ leaf Category ·
   DonorVehicle · ≥1 PartNumber **or** "no visible number" ticked) → `draft → published`. → [`domain-model.md`](../domain-model.md) *Listing lifecycle*, [#8](https://github.com/Lucy-yunn/test/issues/8).

### 4.3 Cancellation ([ADR-0005](../adr/0005-always-approves-cancellation.md))
Buyer raises a `CancellationRequest` (pre-ship only) with a reason → `pending`, order status
unchanged, banner on both sides, `Listing` stays `reserved`. Resolves **only to `approved`**:
seller (immediate) / staff (any time; sole actor for login-less sellers) / **auto after 7
days**. No reject, no withdrawal. On approval: `Order → cancelled` (`lastReachedStatus` kept),
`Listing → published`. A pending request blocks `→ shipped`, not `→ confirmed`.

### 4.4 Messaging ([ADR-0006](../adr/0006-both-sides-login-messaging.md))
Buyer opens a `Thread` from a listing page — **only if both sides have a login**. One Thread
per `(listing, buyer)`. Immutable text messages, ~4000 chars, no attachments. Seller replies
in the seller-center **Messages** section (one of its two write actions). Staff can read any
Thread, post as **"IVO Support"**, lock, and block a `User`. Unread is `Message.readAt` only —
**not** a `Notification` row.

---

## 5. The ADR set

| ADR | Decision |
|---|---|
| [0001](../adr/0001-architecture-baseline.md) | Next.js 16 App Router · Postgres/Neon · Prisma · Better Auth · next-intl · Vercel Blob · Vercel. DAL is the authz gate. |
| [0002](../adr/0002-donorvehicle-provenance-as-relationship.md) | `DonorVehicle` is a first-class entity; Provenance is the `Listing → DonorVehicle` link. |
| [0003](../adr/0003-provenance-first-generation-grain.md) | Provenance-first: `VehicleGeneration`-grain catalogue, no `Fitment`, no verified compatibility in v1. |
| [0004](../adr/0004-one-role-per-user.md) | One `role` per `User`; no multi-role, no conversion. |
| [0005](../adr/0005-always-approves-cancellation.md) | Cancellation always ends in approval; no reject, no buyer withdrawal; 7-day auto-approve. |
| [0006](../adr/0006-both-sides-login-messaging.md) | Messaging needs a login on both sides; no staff relay. |
| [0007](../adr/0007-staff-entry-no-submission-entity.md) | Staff-entry intake via a spreadsheet; no `SellerSubmission` entity. |
| [0008](../adr/0008-in-app-notifications-email-deferred.md) | Notifications are in-app only; transactional email deferred as one later layer. |

---

## 6. Build sequence

Dependency order, not a schedule. Each step has a full spec already; the build effort writes
code, not decisions.

0. **Project setup** — confirm the modified Next.js 16 conventions against
   `node_modules/next/dist/docs/`; Prisma + Neon (pooled); Better Auth + `admin` plugin;
   next-intl `app/[locale]`; Vercel Blob wrapper; ESLint flat config; Vitest/Playwright. → [ADR-0001](../adr/0001-architecture-baseline.md).

1. **Seed catalogue & fixtures — do this first and completely.** *(Was map fog; it is a build
   task, not a planning ticket, but it gates everything below it.)* Define and produce:
   - the exact **`VehicleMake → VehicleModelGroup → VehicleGeneration`** list (from the pilot
     sellers' real donor vehicles — ask the founder's contacts; ~10–20 makes / ~40–70 models
     / ~80–140 generations), stored as the repo seed fixture ([`domain-model.md`](../domain-model.md) *Vehicles*, [#4](https://github.com/Lucy-yunn/test/issues/4));
   - the exact **leaf `Category`** list under the ~13 frozen `Group`s ([#3](https://github.com/Lucy-yunn/test/issues/3));
   - fictional **seller / `DonorVehicle` / `Listing`** counts and content, tied to that
     catalogue — including **≥ 1 login-enabled seller** with enough **listings** (several
     statuses and `Group`s), **favourites**, **orders** (several statuses), **≥ 1 `pending`
     `CancellationRequest`**, and **threads with unread messages** to exercise **every**
     seller-center surface ([`seller-center.md`](../seller-center.md) §11);
   - representative **buyer** accounts, **orders** across the lifecycle, and **`Notification`**
     rows.
   **Do not start the buyer funnel, Browse, or any search/UI work against an undefined or
   incompatible seed catalogue** — the funnel steps, facets, and "What's in stock" tiles are
   all driven by it.

2. **Schema & DAL skeleton** — the full Prisma schema from [`domain-model.md`](../domain-model.md)
   and the topic docs; `verifySession()` + `requireBuyer/Seller/Staff()` + ownership helpers;
   the DAL-enforced behavioural invariants.

3. **Auth & accounts** — buyer `/register` (atomic `User` + `Buyer`), `/login` → role
   redirect, `/account/settings`; the seed staff script. → [`auth-and-permissions.md`](../auth-and-permissions.md).

4. **Admin tool — intake path** — Sellers (profile + provision login), Vehicle catalogue,
   Parts/PartNumbers (de-dup), Listings/DonorVehicles editor + publish checklist. → [`./admin-tool.md`](./admin-tool.md), [`seller-intake.md`](../seller-intake.md).

5. **Buyer funnel & Browse** — homepage funnel bar, `/browse` provenance match + facets +
   pagination, `/listing/[id]` + "More parts from the same car". → [`buyer-funnel-search.md`](../buyer-funnel-search.md), [`donor-vehicle-parts.md`](../donor-vehicle-parts.md).

6. **Favourites** — add/remove; the buyer favourites area with greyed/badged unavailable
   items + "Find similar". → [`seller-center.md`](../seller-center.md) §10.

7. **Checkout & order lifecycle** — the Buy flow, `/account/orders`, the buyer tracker,
   Confirm receipt; admin Order Management (confirm / ship / deliver / shipping cost). → [`order-model.md`](../order-model.md).

8. **Cancellation** — request flow, the pending banner, seller/staff approve, the Vercel Cron
   auto-approve sweep, admin Pending-cancellations list. → [`order-model.md`](../order-model.md) §6, [ADR-0005](../adr/0005-always-approves-cancellation.md).

9. **Messaging** — `Thread`/`Message`, the buyer Messages area, the seller-center reply box,
   admin Threads + report queue + lock/block. → [`messaging-model.md`](../messaging-model.md).

10. **Seller center** — Overview tiles, Orders (+ approve cancellation), Listings (read-only +
    category breakdown), Store details. → [`seller-center.md`](../seller-center.md).

11. **Notifications** — the `Notification` writes inside the DAL transition functions, the
    per-user feed (buyer bell + seller-center item), the cron warning. → [`notifications.md`](../notifications.md).

12. **Shell & polish** — language `<select>`, the full commerce footer + policy blocks
    (**legal copy is placeholder — needs a real pass before any launch**), empty states,
    404 / 403 pages.

---

## 7. Explicitly out of v1

From the map's *Out of scope* and the deferrals across the topic docs:

- Real payments, escrow, cross-border settlement.
- Self-serve seller listing UI.
- **Platform-verified cross-vehicle compatibility** — a `Fitment` entity, confirmed-fit
  badges, a fitment database, VIN decoding, part-number supersession, a buyer "didn't fit"
  loop ([ADR-0003](../adr/0003-provenance-first-generation-grain.md)).
- Returns & refunds (v1 is pre-ship cancellation only).
- **Transactional email** of any kind — deferred as **one** later layer covering auth + order
  + cancellation + message email together ([ADR-0008](../adr/0008-in-app-notifications-email-deferred.md)).
- Marketing / finance / customer-service / store-management / subscription modules; promoted
  listings & ad analytics; ratings / reviews / seller scores.
- View / impression / visitor-click analytics (no entity; favourites + active threads are the
  interest signal).
- Buyer keyword search, OEM part-number lookup, free category browse (the funnel is the only
  entry point). "Most Viewed" → v2.
- Multi-location sellers (one Seller → one Location).
- Shopping cart / multi-listing checkout.
- Self-serve account deletion / GDPR erasure flow.
- Full non-English translation content (routing + EN/BG catalogs scaffolded; only EN complete).

---

## 8. Known follow-ups carried into build

| Item | Where it's handled |
|---|---|
| **Seed catalogue & fixtures** | Build step 1 above — gates the funnel/search work. |
| **Transactional-email layer** | One post-v1 effort — provider (EU region, SPF/DKIM) + Better Auth email hooks + email on auth/order/cancellation/message events. `Notification` rows are the seam. |
| **Legal / policy copy** | Placeholder throughout ([`buyer-funnel-search.md`](../buyer-funnel-search.md) §6) — a real pass before launch. |
| **Cron wiring** | Vercel Cron for the cancellation auto-approve sweep ([`order-model.md`](../order-model.md) §6.5) — an implementation detail; the rule is fixed. |
| **`Report` storage shape** | Own table vs. a status on `Thread` — a build decision; the rule (staff get a queue) is fixed ([`messaging-model.md`](../messaging-model.md) §8). |

The Wayfinder map (#1) is **complete** with this ticket — no open child tickets remain. The
build is a separate effort that starts from this document.
