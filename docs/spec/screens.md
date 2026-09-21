# v1 Screen Inventory

Every screen across the four surfaces, mapped to its audience, purpose, key data/actions, and
the **owning doc** that specifies it. This is an index — the owning doc is authoritative for
behaviour.

- All routes are under `app/[locale]/…`. `[id]` / `[code]` are the readable codes where they
  exist (`LST-` / `ORD-` / `PRT-`).
- **Audience** uses the [permission-matrix](../auth-and-permissions.md) §7 vocabulary:
  Anonymous · Buyer · Seller (= `role = seller`, always with a login) · Staff. "Buyer-only actions"
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
| `/listing/[id]` | Anonymous + all | One `Listing`. Photo gallery (count), Part (name, Category, `attributes`, `PartNumber`s or "no visible number"), **This item** (`condition` + notes, `ListingDefect` bullet list, dimensions/weight, `priceEur`, `negotiable`), a **seller card** (avatar, name, rating or "New seller", city, last active, chat icon, **View all parts**, and the phone number for signed-in users only, otherwise a **"Sign in to get seller contact"** button), **Provenance** (`Removed from: <masked donor label>` + donor engine/code/gearbox, and **View other parts of this car** linking to `/car/[id]`), **"More parts from the same car · N"** section. | **Reserve this part** (buyer-only; disabled for an unavailable seller), **Save** (buyer-only), **Message seller** (buyer-only). Only `published` / `reserved` listings are reachable. | [#8](https://github.com/Lucy-yunn/carparts/issues/8), [`buyer-funnel-search.md`](../buyer-funnel-search.md) §2.1, [`donor-vehicle-parts.md`](../donor-vehicle-parts.md), [`seller-profile.md`](../seller-profile.md) §3 and §9, [`order-model.md`](../order-model.md) §2, [`messaging-model.md`](../messaging-model.md) §3.2 |
| `/sellers/[id]` | Anonymous + all | The public **seller profile**. Header (avatar, name, rating, city, phone or sign-in button, last active, on IVO since; chat, save heart, share) and three tabs: **All Cars** (donor-vehicle cards, filters, sort), **Parts** (Browse-style list and facets scoped to the seller), **Reviews** (see below). | save (buyer-only); chat opens a "which part?" picker; **Leave a review** (buyer-only) | [`seller-profile.md`](../seller-profile.md), [`reviews.md`](../reviews.md) |
| `/sellers/[id]?tab=reviews` | Anonymous + all | Total and average, **Sort by** Newest / Highest / Lowest, then reviews: avatar, username, stars, context label (purchased part name or **No purchase**), text, and the seller's reply indented beneath with a **Seller reply** label. | **Leave a review** → form (rating, optional text, optional purchase choice); signed-out goes to login | [`reviews.md`](../reviews.md) |
| `/car/[id]` | Anonymous + all | The **donor-vehicle page**: the car's ID card (photos, full detail, VIN masked, why it was scrapped, seller link), then its parts — on the shelf first, `reserved` badged, `sold` greyed last. | open a part | [`seller-profile.md`](../seller-profile.md) §6 |
| `/checkout` (or a listing-scoped step) | Buyer | Single lightweight **reserve** page — **not** a wizard. Item summary; saved delivery address with **Edit** (city pre-filled from **Delivery to**); the cash-on-delivery statement (pay the seller after inspecting the part at the courier; the courier fee is extra). | **Reserve this part** → `Order` `placed`, address + `itemPriceEur` snapshot, `Listing → reserved`, land on the order detail page. Concurrency: a second buyer past this point on an already-`reserved` listing gets "no longer available". | [`order-model.md`](../order-model.md) §2 |
| `/login` | Anonymous | One login for all roles. Email + password; social buttons **disabled**; *"Trouble signing in? Contact us."* (no "Forgot password?"). | post-auth redirect by role: `staff → /admin`, `seller → /seller`, `buyer → redirect param or /` | [`auth-and-permissions.md`](../auth-and-permissions.md) §10 |
| `/register` | Anonymous | Buyer self-registration only. Email · password (min 8) · full name · **Terms & Privacy** checkbox; social buttons disabled. | `User` (`role=buyer`) **+ `Buyer` profile created atomically in one transaction**; auto sign-in; redirect to the gated action or `/`. | [`auth-and-permissions.md`](../auth-and-permissions.md) §3 |
| Policy / footer pages | Anonymous + all | **Buying / Help / Legal** columns; operator + VAT line; payment-methods row; policy blocks: **Condition & returns**, **How matching works** (provenance-based, IVO verifies no cross-vehicle fit, check the part number + engine details, seller is the contracting party), **Demo-build disclaimer**. **Legal copy is placeholder.** | static pages | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §6 |
| Shell chrome (every page) | — | Top bar: language **`<select>`** (EN live; BG/NL/DE/FR/RO placeholders → "not translated yet" + revert); **Delivery to** control (IP-suggested city, editable, only pre-fills the reserve step); header utilities: **Activity/bell**, **Saved**, **My orders**, log in. There is **no cart**. | the bell opens the buyer notification feed (§2 below) | [`buyer-funnel-search.md`](../buyer-funnel-search.md) §6, [`notifications.md`](../notifications.md) §5 |

---

## 2. Buyer account (`/account/*`) — `role = buyer`

| Route | Purpose | Key data / actions | Owning doc |
|---|---|---|---|
| `/account/orders` | List of the buyer's own orders, newest first. | order code · item (read through to the retained Listing) · status badge · `placedAt` · `itemPriceEur` | [`order-model.md`](../order-model.md) §7 |
| `/account/orders/[code]` | One order (own only). **Status tracker** (`placed → confirmed → completed`, a short line under the current step; or the refused or cancelled view with `lastReachedStatus` above + reason below); the item; the cash-on-delivery note; delivery-address snapshot; seller name, avatar, rating, city and phone, linking to the profile. | **Cancel order** (instant when `placed`; a request when `confirmed` with none pending → choose a reason); **Message seller**; **Leave a review** (when `completed`, not yet reviewed). | [`order-model.md`](../order-model.md) §6–7, §11 |
| `/account/saved/parts` , `/account/saved/sellers` | Two tabs, styled like the seller-profile tabs: **Saved Parts** and **Saved Sellers**. Saved Parts: a listing that went `reserved`(other)/`sold`/`cancelled`/`archived` is **kept**, greyed, badged (**Reserved / Sold / No longer available**), with a **"Find similar"** link. Saved Sellers: one card each (avatar, name, rating, city, last active, parts on the shelf), greyed if the seller is no longer available. No notifications on change. | unsave; Find similar | [`seller-profile.md`](../seller-profile.md) §8, [`seller-center.md`](../seller-center.md) §10 |
| `/account/messages` | All the buyer's Threads, newest by `lastMessageAt`, per-thread unread count. | open a Thread | [`messaging-model.md`](../messaging-model.md) §5 |
| `/account/messages/[thread]` | One Thread: **live pinned listing header** (photo · title · price · current status badge — Reserved/Sold/No longer listed), append-only message list, reply box. | send a message (~4000 chars, immutable); **Report** the Thread. Blocked if the Thread is staff-locked or the user is messaging-blocked. | [`messaging-model.md`](../messaging-model.md) §3–4, §7 |
| `/account/settings` | Self-service profile. | edit `name` ✅ · `password` ✅ (needs current) · delivery address (7 fields) ✅ · `email` ✗ ("Contact us") · delete account ✗ | [`auth-and-permissions.md`](../auth-and-permissions.md) §3.3 |
| `/account/activity` (bell) | The buyer **notification feed** — reverse-chronological `Notification` rows (icon by `type`, one line, relative time), unread count, **Mark all as read**. Order, cancellation and review-reply events only; **message events are not here** (they stay on the Messages badge). | opening a subject clears its rows | [`notifications.md`](../notifications.md) §5 |

---

## 3. Seller center (`/seller/*`) — `role = seller`

Every seller has a login and so a seller center. Every query is scoped to the signed-in
`Seller.id`. The seller **operates their own orders**; Listing is still staff-only.

| Route | Purpose | Key data / actions | Owning doc |
|---|---|---|---|
| `/seller` | **Overview** — the landing page. Eight read-only tiles (number + label + deep link), no trends. | **Open orders** (`placed`/`confirmed`) · **Pending cancellations** · **Unread messages** · **Active listings** (`published`/`reserved`) · **Total favourites** · **Items sold** (`completed`) · **Rating** · **Credits** | [`seller-center.md`](../seller-center.md) §5 |
| `/seller/orders` | The Seller's orders, newest first. Flat `Order.status` filter. Orders with a `pending` `CancellationRequest` pinned under a "Cancellation requested" heading. | filter by status | [`seller-center.md`](../seller-center.md) §3.1 |
| `/seller/orders/[code]` | One order (own). Full delivery address + buyer phone; the cash-on-delivery reminder; the item; status tracker with timestamps (or the cancelled or refused view); the `CancellationRequest` + reason when present. | **Confirm order** (`placed`); **Mark completed** and **Mark refused** (`confirmed`, no pending cancellation); **Approve cancellation** (only while `pending`, with the auto-approve date and a "Message the buyer first" link); **Message buyer**. | [`seller-center.md`](../seller-center.md) §3.2–3.3, [`order-model.md`](../order-model.md) §3, §6.3, §11 |
| `/seller/reviews` | Reviews of this seller, newest first, with the rating aggregate. | **Reply** once to each review | [`reviews.md`](../reviews.md) §6 |
| `/seller/credits` | Current balance and the ledger, newest first. Says "To add credits, contact IVO." | none | [`seller-credits.md`](../seller-credits.md) §5 |
| `/seller/listings` | **Every** listing (`Listing.sellerId` = me) in **all six statuses**. Columns: photo · title · Category · price · status · favourites count · `publishedAt`. Plus a small **category breakdown** block: active listings grouped by `Group` (plain counts, `Lighting 5 · Brakes 4 · …`). | filter by status | [`seller-center.md`](../seller-center.md) §6.1–6.2 |
| `/seller/listings/[id]` | Read-only rendering of the Listing as staff entered it: Part · This item · **Provenance** (`DonorVehicle` label, `VehicleGeneration`, donor engine/code/fuel/transmission/body/drivetrain, VIN masked) · three metrics (favourites · orders · active threads). Line: *"To change anything on this listing, message IVO."* | none — no edit form | [`seller-center.md`](../seller-center.md) §6.3 |
| `/seller/messages` | The Seller's Threads + **reply box**. | send a message; **Report** a Thread | [`seller-center.md`](../seller-center.md) §2, [`messaging-model.md`](../messaging-model.md) §5 |
| `/seller/store` | Read-only view of the Seller's own `displayName`, avatar, contact fields, and embedded Location — exactly as buyers see it. | none | [`seller-center.md`](../seller-center.md) §2 |
| `/seller/notifications` | The same `Notification` feed as the buyer bell, as a seller-center item, linking to `/seller/orders/[code]`. | Mark all as read | [`notifications.md`](../notifications.md) §5–6 |
| `/seller/settings` (password) | Change own password. | — | [`auth-and-permissions.md`](../auth-and-permissions.md) §4.2 |
| Empty states | Login provisioned but no listings → *"IVO is preparing your listings."*, tiles read `0`. Listings but no orders → *"No orders yet."* No reviews → *"No reviews yet."* | — | [`seller-center.md`](../seller-center.md) §9 |

**Not in the seller center** ([`seller-center.md`](../seller-center.md) §8): Marketing /
Customer Service / Finance / Store Management / Subscriptions nav; ad and seller-performance
scores; view counts; a returns/refund surface; seller editing of listings/prices/store; buying
credits; trends / charts / date ranges; payout / invoicing; email/push.

---

## 4. Admin tool (`/admin/*`) — `role = staff`

English-only. Full detail in [`./admin-tool.md`](./admin-tool.md); routes listed here for the
inventory.

| Route | Purpose | Owning rules |
|---|---|---|
| `/admin` | Dashboard — read-only counts (**Awaiting seller**, **Awaiting completion**, **Pending cancellations**, **Low credits**) and one action queue, **Reported threads**. | [`notifications.md`](../notifications.md) §4, [`order-model.md`](../order-model.md) §11, [`messaging-model.md`](../messaging-model.md) §7 |
| `/admin/sellers` , `/admin/sellers/new` , `/admin/sellers/[id]` | Seller profiles with credit balance; **New seller** (Phase 1 profile, avatar, no `User` yet); **Provision login** (collision check, one-time password), **Disable / Enable / Unlink login** (warns on open orders), **Reset password**; the **Credits panel** (add bundle, adjust with a note, ledger). | [`auth-and-permissions.md`](../auth-and-permissions.md) §4, [`seller-credits.md`](../seller-credits.md) §4 |
| `/admin/credit-bundles` | CRUD over credit bundles (name, credits, price, active, order). | [`seller-credits.md`](../seller-credits.md) §1 |
| `/admin/reviews` | Every review with seller, reviewer, rating, label, reply and hidden state; **Hide** (reason required) and **Unhide**. | [`reviews.md`](../reviews.md) §5 |
| `/admin/buyers` , `/admin/buyers/[id]` | View buyers; **Reset password**. | [`auth-and-permissions.md`](../auth-and-permissions.md) §7.3 |
| `/admin/catalogue` | Vehicle catalogue — `VehicleMake` / `VehicleModelGroup` / `VehicleGeneration`; add during intake (resolves `— NOT LISTED —`). Seed fixture is the source of truth; CRUD is minimal. | [#4](https://github.com/Lucy-yunn/carparts/issues/4), [ADR-0003](../adr/0003-provenance-first-generation-grain.md), [`seller-intake.md`](../seller-intake.md) §2.4 |
| `/admin/parts` , `/admin/parts/[code]` | Parts & PartNumbers — search, detail (`attributes` JSONB, `PartNumber` rows, `partStatus` `provisional → confirmed`, `pnStatus`), de-dup prompt on `PartNumber.normalized`, staff **hard-merge** with tombstone + audit. | [#5](https://github.com/Lucy-yunn/carparts/issues/5) |
| `/admin/donor-vehicles` , `/admin/donor-vehicles/[id]` | Donor-first intake: create a `DonorVehicle` (Generation + structured detail + VIN/mileage/notes), then add its Listings. | [`domain-model.md`](../domain-model.md) *DonorVehicle*, [ADR-0002](../adr/0002-donorvehicle-provenance-as-relationship.md), [`seller-intake.md`](../seller-intake.md) §7 |
| `/admin/listings` , `/admin/listings/new` , `/admin/listings/[id]` | Listing editor — Part link, condition + notes, `ListingDefect` rows, photo upload/order/downscale, `priceEur` (copied unchanged), dimensions; **publish checklist**; status transitions (`draft → published`, `published ↔ cancelled`, `→ archived`; never `sold` by hand). | [#8](https://github.com/Lucy-yunn/carparts/issues/8), [`seller-intake.md`](../seller-intake.md) §3, §5 |
| `/admin/orders` , `/admin/orders/[code]` | **Read-only.** Every order with age for open ones, filters by status, seller and "cancellation pending", sortable by age; the detail shows everything. **No action buttons.** | [`order-model.md`](../order-model.md) §3, §11, [ADR-0009](../adr/0009-seller-operated-orders-cash-on-delivery.md) |
| `/admin/threads` , `/admin/threads/[id]` | Read any Thread; post as **"IVO Support"**; **Lock / Unlock**; resolve the **report queue**; **Block a `User`** from messaging (`messagingBlockedAt`). | [`messaging-model.md`](../messaging-model.md) §7, [ADR-0006](../adr/0006-both-sides-login-messaging.md) |

**Not built:** staff-management UI (staff are seed-script only), impersonation, any of the Q15
seller-facing modules.

---

## 5. Screens deferred / not built in v1

| Screen | Status |
|---|---|
| Homepage **"Most Viewed"** carousel | v2 — the markup may exist greyed/tagged in the prototype but it is not a v1 feature ([`buyer-funnel-search.md`](../buyer-funnel-search.md) §1). |
| **Forgot-password** flow / email-verification screens | No transactional email in v1 ([ADR-0008](../adr/0008-in-app-notifications-email-deferred.md)). |
| **Returns / refunds** screens | Out of scope — cancellation before handover, and `refused` at the courier, only. |
| **Shipping, tracking and courier** screens | Removed — cash on delivery, no platform tracking ([ADR-0009](../adr/0009-seller-operated-orders-cash-on-delivery.md)). |
| **Seller credit purchase** and any payment screen | Not built — staff record top-ups ([`seller-credits.md`](../seller-credits.md) §4). |
| **Follow-a-seller alerts** | Not built — saving a seller sends no notifications. |
| **Account deletion / data-export** screens | Post-v1 ([`auth-and-permissions.md`](../auth-and-permissions.md) §9). |
| Notification **preferences** screen | No preferences in v1 — all notifications are transactional ([`notifications.md`](../notifications.md) §2). |
| Seller **listing editor / edit-request form** | Staff-only; a structured seller change channel is [#14](https://github.com/Lucy-yunn/carparts/issues/14) territory, not built. |

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
