# v1 Screen Inventory

Every screen across the four surfaces, mapped to its audience, purpose, key data/actions, and
the **owning doc** that specifies it. This is an index — the owning doc is authoritative for
behaviour.

- All routes are under `app/[locale]/…`. `[id]` / `[code]` are the readable codes where they
  exist (`LST-` / `ORD-` / `PRT-`).
- **Audience** uses the [permission-matrix](../auth-and-permissions.md) §7 vocabulary:
  Anonymous · Buyer · Seller (= `role = seller` **with a login**) · Staff. "Buyer-only actions"
  means `seller` / `staff` sessions see the control **disabled**.
- Enforcement is always the **DAL** ([`auth-and-permissions.md`](../auth-and-permissions.md) §10);
  `proxy.ts` only does an optimistic redirect.

---

## 1. Buyer site (`/`)

| Route | Audience | Purpose | Key data / actions | Owning doc |
|---|---|---|---|---|
| `/` | Anonymous + all | Homepage. Hero + **funnel bar** (`Make · Model · Generation · Part` + Search); below: *Most Viewed* (**v2 — not built**), then **"What's in stock right now"** category tiles with live in-stock counts. No "How IVO works" block. | tap a slot → options panel; Generation panel = spec cards (year range · chassis codes · bodies) + "not sure"; Search navigates to `/browse` once Make+Model set | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §1 |
| `/browse` | Anonymous + all | Results for a funnel selection. Breadcrumb `Home › Make › Model › Group › Category`; H1 `Used <Make> <Model> <Category>`; left **facet rail**, right **result rows**; numbered pagination; `N parts found` + removable chips + Clear filters; **`Sort by`** (default *Newest first*). Standing note: "same-generation ≠ guaranteed fit". | facets: **Category / Generation / Engine / Fuel / Gearbox / Quality / Price** (Engine/Fuel/Gearbox = donor-attribute narrowing, not compatibility; null donor value never matches). Result row: photo · title · `Taken from: <Generation>` · donor engine/code/fuel/transmission line · condition chip · part number · seller (name, city, flag) · listed-age · defect bullets. **No fit badge.** | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §2–4 |
| `/browse` (empty) | Anonymous + all | Zero-result panel — not a bare "0 results". | "Notify me when one is listed" · "Search all `<Model>` generations" (clears the Generation facet) · "Clear the other filters" | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §5 |
| `/listing/[id]` | Anonymous + all | One `Listing`. Photo gallery (count), Part (name, Category, `attributes`, `PartNumber`s or "no visible number"), **This item** (`condition` + notes, `ListingDefect` bullet list, dimensions/weight, `priceEur`, `negotiable`), **Provenance** (`Removed from: <masked donor label>` + donor engine/code/gearbox), **"More parts from the same car · N"** section. | **Buy** (buyer-only), **Favorite** (buyer-only), **Message seller** (buyer-only; hidden/disabled if the seller has no login → *"Messaging isn't available for this seller"*). Only `published` / `reserved` listings are reachable. | [#8](https://github.com/Lucy-yunn/test/issues/8), [`buyer-funnel-search.md`](../buyer-funnel-search.md) §2.1, [`donor-vehicle-parts.md`](../donor-vehicle-parts.md), [`order-model.md`](../order-model.md) §2, [`messaging-model.md`](../messaging-model.md) §3.2 |
| `/checkout` (or a listing-scoped step) | Buyer | Single lightweight confirmation page — **not** a wizard. Item summary; saved delivery address with **Edit**; shipping shown as "arranged with the seller after purchase". | **Place order** → `Order` `placed`, address + `itemPriceEur` snapshot, `Listing → reserved`, land on the order detail page. Concurrency: a second buyer past this point on an already-`reserved` listing gets "no longer available". | [`order-model.md`](../order-model.md) §2 |
| `/login` | Anonymous | One login for all roles. Email + password; social buttons **disabled**; *"Trouble signing in? Contact us."* (no "Forgot password?"). | post-auth redirect by role: `staff → /admin`, `seller → /seller`, `buyer → redirect param or /` | [`auth-and-permissions.md`](../auth-and-permissions.md) §10 |
| `/register` | Anonymous | Buyer self-registration only. Email · password (min 8) · full name · **Terms & Privacy** checkbox; social buttons disabled. | `User` (`role=buyer`) **+ `Buyer` profile created atomically in one transaction**; auto sign-in; redirect to the gated action or `/`. | [`auth-and-permissions.md`](../auth-and-permissions.md) §3 |
| Policy / footer pages | Anonymous + all | **Buying / Help / Legal** columns; operator + VAT line; payment-methods row; policy blocks: **Condition & returns**, **How matching works** (provenance-based, IVO verifies no cross-vehicle fit, check the part number + engine details, seller is the contracting party), **Demo-build disclaimer**. **Legal copy is placeholder.** | static pages | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §6 |
| Shell chrome (every page) | — | Top bar: language **`<select>`** (EN live; BG/NL/DE/FR/RO placeholders → "not translated yet" + revert); Delivery-to indicator; header utilities: **Activity/bell**, **Favourites**, cart, log in. | the bell opens the buyer notification feed (§2 below) | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §6, [`notifications.md`](../notifications.md) §5 |

---

## 2. Buyer account (`/account/*`) — `role = buyer`

| Route | Purpose | Key data / actions | Owning doc |
|---|---|---|---|
| `/account/orders` | List of the buyer's own orders, newest first. | order code · item (read through to the retained Listing) · status badge · `placedAt` · `itemPriceEur` | [`order-model.md`](../order-model.md) §7 |
| `/account/orders/[code]` | One order (own only). **Status tracker** (4 steps + expected-time line under the current step; or cancelled view with `lastReachedStatus` above + reason below); the item; shipping cost + notes + total; delivery-address snapshot; seller **display name + city/country only**; tracking number once shipped. | **Cancel order** (when `placed`/`confirmed`, no pending request → choose a reason → `CancellationRequest`); **Confirm receipt** (when `shipped` → `delivered`); **Message seller** (opens/re-uses the `(listing,buyer)` Thread). | [`order-model.md`](../order-model.md) §6–9, §11 |
| `/account/favourites` | The buyer's `Favorite` rows. A favourited listing that went `reserved`(other)/`sold`/`cancelled`/`archived` is **kept**, greyed, badged (**Reserved / Sold / No longer available**), reads through to the retained Listing, with a **"Find similar"** link back into the funnel at that Part's Category. No notification on status change. | unfavourite; Find similar | [`seller-center.md`](../seller-center.md) §10 |
| `/account/messages` | All the buyer's Threads, newest by `lastMessageAt`, per-thread unread count. | open a Thread | [`messaging-model.md`](../messaging-model.md) §5 |
| `/account/messages/[thread]` | One Thread: **live pinned listing header** (photo · title · price · current status badge — Reserved/Sold/No longer listed), append-only message list, reply box. | send a message (~4000 chars, immutable); **Report** the Thread. Blocked if the Thread is staff-locked or the user is messaging-blocked. | [`messaging-model.md`](../messaging-model.md) §3–4, §7 |
| `/account/settings` | Self-service profile. | edit `name` ✅ · `password` ✅ (needs current) · delivery address (7 fields) ✅ · `email` ✗ ("Contact us") · delete account ✗ | [`auth-and-permissions.md`](../auth-and-permissions.md) §3.3 |
| `/account/activity` (bell) | The buyer **notification feed** — reverse-chronological `Notification` rows (icon by `type`, one line, relative time), unread count, **Mark all as read**. Order + cancellation events only; **message events are not here** (they stay on the Messages badge). | opening a subject clears its rows | [`notifications.md`](../notifications.md) §5 |

---

## 3. Seller center (`/seller/*`) — `role = seller` with a login

A login-less Seller has **no seller center at all**. Every query is scoped to the signed-in
`Seller.id`. **Near-read-only: exactly two write actions** (reply to a message; approve a
pending cancellation).

| Route | Purpose | Key data / actions | Owning doc |
|---|---|---|---|
| `/seller` | **Overview** — the landing page. Six read-only tiles (number + label + deep link), no trends. | **Open orders** (`placed`/`confirmed`/`shipped`) · **Pending cancellations** · **Unread messages** · **Active listings** (`published`/`reserved`) · **Total favourites** · **Items sold** (`delivered`) | [`seller-center.md`](../seller-center.md) §5 |
| `/seller/orders` | The Seller's orders, newest first. Flat `Order.status` filter (**not** Q15 buckets). Orders with a `pending` `CancellationRequest` pinned under a "Cancellation requested" heading. | filter by status | [`seller-center.md`](../seller-center.md) §3.1 |
| `/seller/orders/[code]` | One order (own). Full delivery address + buyer phone; the item; status tracker with timestamps (or cancelled view); shipping; tracking; the `CancellationRequest` + reason when present. | **Approve cancellation** (only while `pending` — immediate, irreversible; beside it the `autoApproveAt` date + "Message the buyer first" link); **Message buyer**. **Cannot** confirm / ship / deliver / enter tracking — those are staff-only. | [`seller-center.md`](../seller-center.md) §3.2, [`order-model.md`](../order-model.md) §6.3, §11 |
| `/seller/listings` | **Every** listing (`Listing.sellerId` = me) in **all six statuses**. Columns: photo · title · Category · price · status · favourites count · `publishedAt`. Plus a small **category breakdown** block: active listings grouped by `Group` (plain counts, `Lighting 5 · Brakes 4 · …`). | filter by status | [`seller-center.md`](../seller-center.md) §6.1–6.2 |
| `/seller/listings/[id]` | Read-only rendering of the Listing as staff entered it: Part · This item · **Provenance** (`DonorVehicle` label, `VehicleGeneration`, donor engine/code/fuel/transmission/body/drivetrain, VIN masked) · three metrics (favourites · orders · active threads). Line: *"To change anything on this listing, message IVO."* | none — no edit form | [`seller-center.md`](../seller-center.md) §6.3 |
| `/seller/messages` | The Seller's Threads + **reply box** — one of the two write actions. | send a message; **Report** a Thread | [`seller-center.md`](../seller-center.md) §2, [`messaging-model.md`](../messaging-model.md) §5 |
| `/seller/store` | Read-only view of the Seller's own `displayName`, contact fields, and embedded Location — exactly as buyers see it. | none | [`seller-center.md`](../seller-center.md) §2 |
| `/seller/notifications` | The same `Notification` feed as the buyer bell, as a seller-center item, linking to `/seller/orders/[code]`. | Mark all as read | [`notifications.md`](../notifications.md) §5–6 |
| `/seller/settings` (password) | Change own password. | — | [`auth-and-permissions.md`](../auth-and-permissions.md) §4.2 |
| Empty states | Login provisioned but no listings → *"IVO is preparing your listings."*, tiles read `0`. Listings but no orders → *"No orders yet."* | — | [`seller-center.md`](../seller-center.md) §9 |

**Not in the seller center** (Q15 boundary, [`seller-center.md`](../seller-center.md) §8):
Cancellations / Marketing / Customer Service / Finance / Store Management / Subscriptions nav;
ad & seller-performance; ratings/reviews; view counts; return/refund surface; seller editing
of listings/prices/store; trends / charts / date ranges; payout / invoicing; email/push.

---

## 4. Admin tool (`/admin/*`) — `role = staff`

English-only. Full detail in [`./admin-tool.md`](./admin-tool.md); routes listed here for the
inventory.

| Route | Purpose | Owning rules |
|---|---|---|
| `/admin` | Dashboard — the three action queues: **Orders needing confirmation** (`status = placed`), **Pending cancellations** (sorted by `autoApproveAt`), **Reported threads**. | [`notifications.md`](../notifications.md) §4, [`order-model.md`](../order-model.md) §6.5, [`messaging-model.md`](../messaging-model.md) §7 |
| `/admin/sellers` , `/admin/sellers/new` , `/admin/sellers/[id]` | Seller profiles; **New seller** (Phase 1 profile, no `User`); **Provision login** (collision check, one-time password), **Disable / Enable / Unlink login**, **Reset password**. | [`auth-and-permissions.md`](../auth-and-permissions.md) §4 |
| `/admin/buyers` , `/admin/buyers/[id]` | View buyers; **Reset password**. | [`auth-and-permissions.md`](../auth-and-permissions.md) §7.3 |
| `/admin/catalogue` | Vehicle catalogue — `VehicleMake` / `VehicleModelGroup` / `VehicleGeneration`; add during intake (resolves `— NOT LISTED —`). Seed fixture is the source of truth; CRUD is minimal. | [#4](https://github.com/Lucy-yunn/test/issues/4), [ADR-0003](../adr/0003-provenance-first-generation-grain.md), [`seller-intake.md`](../seller-intake.md) §2.4 |
| `/admin/parts` , `/admin/parts/[code]` | Parts & PartNumbers — search, detail (`attributes` JSONB, `PartNumber` rows, `partStatus` `provisional → confirmed`, `pnStatus`), de-dup prompt on `PartNumber.normalized`, staff **hard-merge** with tombstone + audit. | [#5](https://github.com/Lucy-yunn/test/issues/5) |
| `/admin/donor-vehicles` , `/admin/donor-vehicles/[id]` | Donor-first intake: create a `DonorVehicle` (Generation + structured detail + VIN/mileage/notes), then add its Listings. | [`domain-model.md`](../domain-model.md) *DonorVehicle*, [ADR-0002](../adr/0002-donorvehicle-provenance-as-relationship.md), [`seller-intake.md`](../seller-intake.md) §7 |
| `/admin/listings` , `/admin/listings/new` , `/admin/listings/[id]` | Listing editor — Part link, condition + notes, `ListingDefect` rows, photo upload/order/downscale, `priceEur` (copied unchanged), dimensions; **publish checklist**; status transitions (`draft → published`, `published ↔ cancelled`, `→ archived`; never `sold` by hand). | [#8](https://github.com/Lucy-yunn/test/issues/8), [`seller-intake.md`](../seller-intake.md) §3, §5 |
| `/admin/orders` , `/admin/orders/[code]` | Full order visibility; transitions **Confirm** / **Mark shipped** (`trackingNumber` + `expectedTimeRange` both required) / **Mark delivered**; enter `shippingCostEur` + `shippingNotes` at/after `confirmed`. Filters incl. "needs confirmation". | [`order-model.md`](../order-model.md) §3, §5, §11 |
| `/admin/cancellations` | Pending-cancellations list (reason + `autoApproveAt`); **Approve any**; **Raise on a seller's behalf** (`requestedBy = staff`). | [`order-model.md`](../order-model.md) §6, [ADR-0005](../adr/0005-always-approves-cancellation.md) |
| `/admin/threads` , `/admin/threads/[id]` | Read any Thread; post as **"IVO Support"**; **Lock / Unlock**; resolve the **report queue**; **Block a `User`** from messaging (`messagingBlockedAt`). | [`messaging-model.md`](../messaging-model.md) §7, [ADR-0006](../adr/0006-both-sides-login-messaging.md) |

**Not built:** staff-management UI (staff are seed-script only), impersonation, any of the Q15
seller-facing modules.

---

## 5. Screens deferred / not built in v1

| Screen | Status |
|---|---|
| Homepage **"Most Viewed"** carousel | v2 — the markup may exist greyed/tagged in the prototype but it is not a v1 feature ([`buyer-funnel-search.md`](../buyer-funnel-search.md) §1). |
| A dedicated / shareable **donor-vehicle page** | Rejected for v1 — "More parts from the same car" is a section on the listing page only ([`donor-vehicle-parts.md`](../donor-vehicle-parts.md) §8). |
| **Forgot-password** flow / email-verification screens | No transactional email in v1 ([ADR-0008](../adr/0008-in-app-notifications-email-deferred.md)). |
| **Returns / refunds** screens | Out of scope — pre-ship cancellation only. |
| **Account deletion / data-export** screens | Post-v1 ([`auth-and-permissions.md`](../auth-and-permissions.md) §9). |
| Notification **preferences** screen | No preferences in v1 — all notifications are transactional ([`notifications.md`](../notifications.md) §2). |
| Seller **listing editor / edit-request form** | Staff-only; a structured seller change channel is [#14](https://github.com/Lucy-yunn/test/issues/14) territory, not built. |

---

## 6. Content that the seed-data task must define (build step 1)

These screens render nothing meaningful until the seed fixtures exist — see
[`README.md`](./README.md) §6 step 1:

- the homepage **"What's in stock"** category tiles (needs the leaf `Category` list + live
  counts from seeded Listings);
- every **funnel** step (needs the `Make → Model → Generation` catalogue);
- **Browse** facet values (needs seeded `DonorVehicle` engine/fuel/gearbox data);
- the whole **seller center** (needs the fully-populated login-enabled seller);
- the **notification feed** and **order/cancellation** screens (need seeded orders across the
  lifecycle + a `pending` `CancellationRequest`).
