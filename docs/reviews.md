# v1 Seller Reviews

Added 2026-09-19 by the founders' v1 scope revision. Decision record:
[ADR-0012](./adr/0012-reviews-open-to-any-buyer.md). Founder mockup: `UI/Seller Profile/10.png`.

Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md). The roles are **buyer**, **seller**,
**staff**. Reviews are about a **seller**, never about a single Listing.

---

## 1. Who can write

- Only a signed-in **buyer**. A **seller** or **staff** account sees the button disabled.
- **No purchase is required and there is no per-buyer limit.**
- A buyer can attach a review to one of their own `completed` orders with that seller. Each
  completed order can carry **at most one** review. A review with no order is allowed any number
  of times.

---

## 2. The review form

Opened by **Leave a review** on the seller profile's Reviews tab, or from a completed order.

| Field | Required | Notes |
|---|---|---|
| Rating | yes | 1 to 5 whole stars |
| Text | no | up to 2,000 characters, plain text |
| Purchase | no | a choice of the buyer's `completed`, not-yet-reviewed orders with this seller, defaulting to the most recent, plus **"No purchase"**. Shown only when such orders exist. |

Signed-out visitors clicking **Leave a review** are sent to sign in and returned. Reviews are
immutable once posted in v1: the author cannot edit or delete. (Staff can hide, §5.)

---

## 3. What a review shows

Avatar and username (`User.name`), the stars and number, then the **context label**, then the text:

- linked to an order: the **purchased part's name** as plain text, not a link (a sold Listing is
  hidden from the public);
- not linked: **"No purchase"**.

If the seller has replied (§6) the reply appears **indented directly beneath** the review with a
**Seller reply** label.

---

## 4. Rating aggregate

- Average and count are over **all non-hidden reviews**, purchase-linked or not.
- Shown as `4.8/5 (10)` on the seller header, the listing-page seller card, and result rows.
- Below **3** non-hidden reviews it shows **"New seller"** instead of a number.

---

## 5. Sorting and moderation

The Reviews tab header shows the total and the average, with **Sort by**: Newest (default),
Highest, Lowest.

**Staff** can hide any review with a **required reason**, and can unhide it. A hidden review
disappears from the tab, the count and the average, and its reply goes with it. There is no
deletion and no queue: staff find reviews in the admin Reviews list.

---

## 6. Seller reply

A **seller** can reply **once** to each review on their own profile, from the seller center's
Reviews section. The reply is plain text up to 1,000 characters and cannot be edited or removed
by the seller. Staff hiding the review hides the reply.

---

## 7. Entity

### Review

| Field | Type | Notes |
|---|---|---|
| `sellerId` | FK → Seller, required | |
| `buyerId` | FK → Buyer, required | |
| `orderId` | FK → Order, nullable, **unique when set** | set only for a purchase-linked review |
| `rating` | int 1–5, required | |
| `body` | text, nullable | |
| `sellerReply` | text, nullable | |
| `sellerRepliedAt` | timestamp, nullable | |
| `hiddenAt` | timestamp, nullable | set when staff hide |
| `hiddenBy` | FK → User, nullable | |
| `hiddenReason` | text, nullable | required when hidden |
| `createdAt` | timestamp, required | |

Invariants, in the DAL:
- `orderId`, when set, must be a `completed` order of this `buyerId` with this `sellerId`;
- the author must have `role = buyer`;
- a reply may be set only once, and only by the seller the review is about.

Known weakness, accepted ([ADR-0012](./adr/0012-reviews-open-to-any-buyer.md)): because a
**seller** sets `completed`, a seller can delay it to avoid a purchase-linked review, and the
open rule makes ratings easy to game. The first remedy, if needed, is to count only purchase-linked
reviews in the average.

---

## 8. Build notes (step 12)

- `Review.rating` is checked between 1 and 5 in the database as well as in the service.
- The header of the Reviews tab shows the raw total and average, and adds "New seller" below 3
  reviews. Everywhere else (seller header, listing card, result rows, saved sellers) the rating
  reads `4.8/5 (10)`, or "New seller".
- The seller replies from `/seller/reviews`, a minimal screen until the full seller center
  (build step 13). Staff work from `/admin/reviews`.
- A completed order's page offers **Leave a review** until that order has one.
- Notifications for new reviews and replies are step 14.
