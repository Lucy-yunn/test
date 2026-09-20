# v1 Notifications — order, cancellation, review & credit events

Originally resolved [Notifications (#17)](https://github.com/Lucy-yunn/carparts/issues/17) on the
[Wayfinder map (#1)](https://github.com/Lucy-yunn/carparts/issues/1). **Revised 2026-09-19**: the
event list follows the new order lifecycle ([`order-model.md`](./order-model.md)), and reviews and
credits add events.

Builds on [Order model](./order-model.md), [messaging model](./messaging-model.md)
(`Message.readAt` unread state), [seller center](./seller-center.md) and
[auth](./auth-and-permissions.md) (§6 — no transactional email in v1). Vocabulary is governed by
[`CONTEXT.md`](../CONTEXT.md). The roles are **buyer**, **seller**, **staff**.

---

## 1. Scope — in-app only, no email in v1

**v1 has no transactional email of any kind** ([ADR-0008](./adr/0008-in-app-notifications-email-deferred.md)).
The whole mechanism is:

1. a **`Notification`** row per event, per recipient who is a **buyer** or a **seller**;
2. a **per-user feed** with an unread count (§5);
3. the contextual state other specs already define: the order tracker, the `Message.readAt`
   unread badge, and the seller-center Overview tiles.

**Staff receive no notifications and have no feed.** They work from the admin lists (§4). Every
seller now has a login ([ADR-0009](./adr/0009-seller-operated-orders-cash-on-delivery.md)), so
every seller has a feed.

Email for auth, order, cancellation, review and message events is deferred together as one later
layer, as before. `Notification` rows are the seam it will hang off.

---

## 2. The `Notification` entity

| Field | Type | Notes |
|---|---|---|
| `userId` | FK → User, required | the recipient; `User.role` is `buyer` or `seller`, never `staff` |
| `type` | enum, required | see §3 |
| `subjectType` | enum, required | `order` \| `cancellation_request` \| `review` \| `credit_ledger_entry` |
| `subjectId` | FK, required | the row the event is about |
| `createdAt` | timestamp, required | |
| `readAt` | timestamp, nullable | set when the recipient opens the subject or clears the feed (§5) |

- **No `Message` subject.** New-message alerting stays on `Message.readAt`.
- No channel columns and no preferences in v1.

Rows are written by the DAL functions in the **same transaction** as the change they describe.

---

## 3. Events

`I` = a `Notification` row in the in-app feed. `—` = nothing.

### 3.1 Buyer

| Event | `type` | Copy |
|---|---|---|
| seller confirmed the order | `order_confirmed` | "The seller confirmed your order" |
| seller marked the order completed | `order_completed` | "Order completed. Leave a review?" |
| seller marked the order refused | `order_refused` | "The seller marked your order as refused" |
| cancellation approved (by the seller, or automatically after 7 days) | `cancellation_approved` | "Cancellation approved. The item is available again" |
| seller replied to your review | `review_replied` | "The seller replied to your review" |

A buyer's own actions (placing an order, cancelling a `placed` order) raise no notification: the
screen already shows the outcome.

### 3.2 Seller

| Event | `type` | Copy |
|---|---|---|
| a buyer reserved one of your parts | `order_placed` | "You have a new order" |
| a buyer requested cancellation of a `confirmed` order | `cancellation_requested` | "Cancellation requested. Approve or wait 7 days" |
| a buyer cancelled a `placed` order | `order_cancelled` | "A buyer cancelled an order" |
| a buyer left a review | `review_received` | "You have a new review" |
| credit balance fell to 5 or fewer (crossing from above 5) | `credits_low` | "5 credits left" |
| credit balance reached 0 | `credits_empty` | "You are out of credits" |

`credits_low` and `credits_empty` fire once when the balance **crosses** the threshold on a
`publish` or `adjustment` entry, not on every later charge. Their subject is the ledger entry that
caused the crossing.

**Removed since the original spec:** `order_shipped`, `order_delivered`, `cancellation_warning`,
and the buyer's `order_placed`.

### 3.3 New messages

Unchanged ([messaging model §6](./messaging-model.md)): an unseen message is unread through
`Message.readAt`, shown on the Messages areas. No `Notification` row.

---

## 4. Staff

**Staff** get no feed. They watch read-only lists in the admin tool
([`spec/admin-tool.md`](./spec/admin-tool.md)):

| Staff need to see | Where |
|---|---|
| orders awaiting a seller, and how long | Orders list, sorted by age; dashboard counts |
| a pending cancellation | Orders list filter |
| a reported thread | report queue ([messaging §7](./messaging-model.md)) |
| a seller running low on credits | Sellers list, balance column |

Staff cannot act on orders. When something is stuck they contact the seller by phone.

---

## 5. The notification feed

One per user with a `buyer` or `seller` role.

- **Buyer** — a bell in the site header with an unread count. Opens a reverse-chronological list.
- **Seller** — the same list as a **Notifications** item in the seller center.

Each row: an icon by `type`, one line of copy, relative time, and a link to the subject.

**Read semantics**
- Opening the **subject** marks every unread row for that subject and user read.
- **Mark all as read** clears the feed.
- The unread count is the user's rows with `readAt = null`.
- Message unread stays separate on the Messages badge.

There is no delete for a single row and no preferences screen.

---

## 6. What changed downstream

- **Seller center** — Notifications is in the nav; the Messages item carries the message unread
  count and the Notifications item carries the feed unread count.
- **Order model** — its transition functions each write the rows above in the same transaction.
  The cancellation cron writes no warning.
- **Credits and reviews** — each writes the events in §3.2 and §3.1.
- **[ADR-0008](./adr/0008-in-app-notifications-email-deferred.md)** — its event list is amended by this document.

---

## 7. Build notes (step 14)

- `credits_low` reads "5 or fewer credits left", because the balance can cross the threshold and land
  below 5. When one charge or adjustment goes straight from above 5 to 0, only `credits_empty` is sent.
- A seller with no login has nobody to notify, so nothing is written for them and nothing fails.
- Opening a subject marks its notices read: an order (and its cancellation request), the seller's
  Reviews, the seller's Credits, and a buyer's view of a seller's Reviews.
- The migration removed the old shipping and warning notification rows, kept `order_delivered` as
  `order_completed`, and removed the buyer `order_placed` rows.
- The admin Sellers list shows each seller's credit balance, so staff can see who is running low.
