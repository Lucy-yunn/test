# v1 Public Seller Profile, Donor-Vehicle Page & Saved Sellers

Added 2026-09-19 by the founders' v1 scope revision. Decision record:
[ADR-0011](./adr/0011-public-seller-profile-and-donor-vehicle-page.md). Founder mockups:
`UI/Seller Profile/7.png` to `10.png`.

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md). The roles are **buyer**, **seller**,
**staff**. This document owns three buyer-facing surfaces: the **seller profile**, the
**donor-vehicle page**, and **saved sellers**. Reviews are specified in [`reviews.md`](./reviews.md).

---

## 1. Routes and access

| Route | Purpose | Audience |
|---|---|---|
| `/sellers/[id]` | Seller profile. Tabs selected by `?tab=cars` (default), `parts`, `reviews`. | anyone, including anonymous |
| `/car/[id]` | Donor-vehicle page: the car's "ID card" and its parts. | anyone |
| `/account/saved/parts`, `/account/saved/sellers` | The buyer's saved parts and saved sellers. | buyer |

`/seller/*` (singular) remains the seller center. The public pages use `/sellers/…` (plural)
and `/car/…` so the two never collide. `[id]` is the record's opaque id.

A seller whose account is disabled or has no login has **no public profile** (404); their
listings are not buyable ([`auth-and-permissions.md`](./auth-and-permissions.md) §4.4).

---

## 2. Seller header

Shown on every tab.

| Element | Source | Notes |
|---|---|---|
| Avatar | `Seller.avatarUrl` | uploaded by **staff**, optional. Falls back to the first letter of the name. |
| Name | `Seller.displayName` | the business name, not a username |
| Rating | reviews aggregate | `4.8/5 (10)`. With fewer than 3 reviews: **New seller**. See [`reviews.md`](./reviews.md) §4. |
| City | `Seller.location.city` (+ country) | |
| Phone | `Seller.contactPhone` | **signed-in users only** (§3) |
| Last active | `Seller.lastActiveAt` | date only |
| On IVO since | earliest `publishedAt` over the seller's Listings | month and year. A seller with no published Listing has no profile yet. |
| Message button | | opens messaging, see §7 |
| Save button (heart) | | saves or unsaves the seller. Signed-out click goes to login. Buyers only. |
| Share button | | copies the profile link |

`Seller.lastActiveAt` is set to the current time when the seller signs in or performs an
action in the seller center, **at most once per day**, and shown as a date.

`Seller.contactEmail` and the contact name are staff-facing and never shown.

---

## 3. Seller contact is sign-in gated

Anonymous visitors do **not** see the phone number anywhere. The place where the number would
appear shows one button, **"Sign in to get seller contact"**, which opens the combined sign-in
and registration page and returns the visitor to the same page. Any signed-in user (buyer,
seller or staff) sees the number.

This applies on the seller profile and on the seller card in the listing page.

---

## 4. Tab: All Cars

The seller's `DonorVehicle`s that have at least one Listing in `published`, `reserved` or
`sold` (a car with only draft or archived parts is hidden).

Header line: **`N cars`** and a sort control. Left rail: filters.

**Card**
- Photo (`DonorVehiclePhoto` first, else the first Listing photo).
- `<Make> <Model> <Generation label>` and donor year.
- Engine · fuel · gearbox · mileage, omitting empty values.
- The first line of `scrapReason`, if set.
- `N on the shelf · M sold` (counts of Listings in `published`/`reserved` and `sold`).
- The card carries **no price** (a car has none).

**Sort:** Newest (default, by the car's most recent `publishedAt`) and Most parts (on-shelf count).

**Filters:** Make, then Generation; Fuel; Mileage band (under 100,000 km · 100,000–200,000 km ·
over 200,000 km); and an **"On the shelf only"** toggle, default off. A car with unknown mileage
never matches a mileage band. Further filters can be added later.

A card links to the donor-vehicle page (§6).

---

## 5. Tab: Parts

The same results list and facet rail as `/browse` ([`buyer-funnel-search.md`](./buyer-funnel-search.md)),
scoped to this seller: Category, Engine, Fuel, Gearbox, Quality and Price facets, whose counts
cover only this seller's `published` and `reserved` Listings. The funnel bar is not shown. Default
sort is Newest first.

Implementation: the existing Browse query with an added `sellerId` condition. No separate query.

---

## 6. The donor-vehicle page

The car's "ID card". Public, at `/car/[id]`.

**Header (the ID card)**
- Photo gallery from `DonorVehiclePhoto` when any exist.
- `<Make> <Model> <Generation label>`, donor year, and the structured detail: engine, engine
  code, fuel, gearbox, body, drivetrain, mileage. VIN is masked exactly as on listing pages.
- **Why this car was scrapped:** the full `scrapReason` text, when set. When not set, the block
  is omitted, not shown empty.
- A link to the seller's profile.

**Parts list** — every Listing whose `donorVehicleId` is this car:

| Listing status | Shown as |
|---|---|
| `published` | normal row, first |
| `reserved` | normal row with a **Reserved** badge, grouped with `published` |
| `sold` | **greyed, last**, no Reserve link, labelled **Sold** |
| `draft`, `cancelled`, `archived` | not shown |

Within each group, newest first. Sold parts appear **only here**. Browse, the seller's Parts tab
and the inline "More parts from the same car" section keep hiding sold Listings.

A car with no visible Listing at all is a 404.

---

## 7. Messaging from the profile

Threads are scoped to one Listing and one buyer ([`messaging-model.md`](./messaging-model.md)
§3.1). On the **listing page**, the seller card's chat icon is the same as **Message seller**.

On the **seller profile**, which has no listing context, the chat button opens a small picker,
**"Which part is your message about?"**, listing the seller's `published` and `reserved`
Listings. Choosing one opens or reuses the Thread for that Listing.

> ⚠ **Founder to confirm.** This picker keeps the existing rule that every Thread is tied to a
> Listing. If the founders would rather allow a general seller-level thread, `Thread.listingId`
> would become nullable and the uniqueness rule would change. The picker is the default until
> decided.

---

## 8. Saved sellers

A **buyer** can save a seller from the heart on the profile. Only buyers can save (staff and
sellers see the heart disabled).

`/account/saved` has two tabs, styled like the seller-profile tabs: **Saved Parts** and **Saved
Sellers**.

- **Saved Parts** — the buyer's saved Listings, exactly as specified in
  [`seller-center.md`](./seller-center.md) §10 (greyed and badged when no longer available, with
  a "Find similar" link).
- **Saved Sellers** — one card per saved seller: avatar, name, rating, city, last active, and a
  count of parts on the shelf. A card links to the profile. A seller who later loses their public
  profile (login disabled) stays in the list, greyed, labelled **No longer available**.

There is no notification when a saved seller lists a new part.

---

## 9. The listing page's seller card

On `/listing/[id]` the buy box carries a seller card: avatar, name, rating, city, last active,
the phone (or the sign-in button, §3), the chat icon (§7), and **View all parts**, which goes to
`/sellers/[id]?tab=parts`. The Donor vehicle heading gains **View other parts of this car**,
linking to `/car/[id]`. The inline "More parts from the same car" section stays as it is
([`donor-vehicle-parts.md`](./donor-vehicle-parts.md)).

---

## 10. Data changes

- `Seller`: add `avatarUrl` (nullable), `lastActiveAt` (nullable).
- `DonorVehicle`: add `scrapReason` (nullable free text) — see
  [`domain-model.md`](./domain-model.md). Entered by staff from the seller's own words.
- New `SavedSeller` (`buyerId`, `sellerId`, unique together, `createdAt`).
- "On IVO since" is derived, never stored.
