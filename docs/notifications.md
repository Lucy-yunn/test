# v1 Notifications — order, cancellation & message events

Resolves [Notifications — order, cancellation & message events (#17)](https://github.com/Lucy-yunn/test/issues/17)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

Builds on [Order model (#10)](./order-model.md) (lifecycle, the 7-day cancellation
auto-approve), [In-app messaging model (#11)](./messaging-model.md) (`Message.readAt` unread
state), [Seller center (#13)](./seller-center.md) (the seller surfaces), and
[Auth, roles & permissions (#12)](./auth-and-permissions.md) (**§6 — no transactional email
in v1**). Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md); the entity skeleton is in
[`docs/domain-model.md`](./domain-model.md).

Both #10 and #11 deliberately specified only their own *in-app* state and deferred the
cross-cutting policy here. This document owns **which events notify whom, through which
channel, and the v1 rules** — as one coherent design.

---

## 1. Scope — in-app only, no email in v1

**v1 has no transactional email of any kind.** This follows
[Auth (#12) §6](./auth-and-permissions.md): no email provider is in the stack, and every user
in the demo is fictional or personally onboarded. The same rationale covers notification
email, so it is ruled out here too.

The **entire v1 notification mechanism** is:

1. a **`Notification`** row per notifiable event, for each recipient who has an in-app
   surface (buyer, or seller-with-login), and
2. a **per-user notification feed** that lists those rows with an unread count (§5), plus
3. the **already-specified contextual state** each other ticket defined — the order tracker
   (#10 §7), the #11 `Message.readAt` unread badge, the seller-center Overview tiles and
   Messages badge (#13 §2, §5).

There is **no notification centre for staff** and **no `Notification` row for staff** — staff
work from the admin-tool lists (§4). Login-less sellers have no surface and are handled by
staff out-of-band (§4), exactly as today.

### Deferred — one transactional-email layer

Email for **auth** events (password reset done, seller login ready — #12 §6), **order**
events, **cancellation** events, and **new messages** is deferred **together**, as a single
later effort: add a provider (EU processing region, SPF/DKIM — the infra note that would have
lived here), wire Better Auth's scaffolded email hooks, and add an email channel to the
events in §3. Nothing in v1 half-builds it. `Notification` rows are the seam the email layer
will hang off (§6).

---

## 2. The `Notification` entity

A lightweight per-recipient record of one event. One table, no per-channel rows, no grouping.

| Field | Type | Notes |
|---|---|---|
| `userId` | FK → User, required | the recipient; their `User.role` is `buyer` or `seller` (never `staff`) |
| `type` | enum, required | see §3.1 |
| `subjectType` | enum, required | `order` \| `cancellation_request` — which table `subjectId` points at |
| `subjectId` | FK, required | the `Order` or `CancellationRequest` the event is about |
| `createdAt` | timestamp, required | |
| `readAt` | timestamp, nullable | set when the recipient opens the subject **or** clears the feed (§5) |

- **No `Message` subject.** New-message notification stays entirely on #11's `Message.readAt`
  mechanism (§3.3) — a `Notification` row per message would double-count against the Messages
  badge.
- **No `emailSentAt` / channel columns in v1** — there is no second channel. The deferred
  email layer (§1) adds per-channel delivery tracking when it lands.
- **No `preferences`** — every notification is transactional (order / cancellation), there is
  nothing to opt out of, and there is no preferences screen in v1 (revisit when a marketing
  channel exists).

Relationship: `User` → many `Notification`. Rows are created by the **DAL transition
functions in the same transaction as the state change they describe** (order status change,
cancellation state change), and by the cancellation **cron** for the auto-approve warning
(§3.2).

---

## 3. The event → audience → channel matrix

`I` = a `Notification` row (in-app feed). `screen` = state already visible in the UI, no
notification raised. `—` = nothing. Staff and login-less sellers never receive `I`.

### 3.1 Order events

| Event | Buyer | Seller (login) | Staff | Login-less seller | `Notification.type` |
|---|---|---|---|---|---|
| `placed` | **I** — "Order placed" | **I** — "You have a sale" | admin Orders "needs confirmation" filter | staff act | `order_placed` |
| `confirmed` | **I** — "Seller confirmed — being prepared" | — | *(self)* | — | `order_confirmed` |
| `shipped` | **I** — tracking number + `expectedTimeRange` | — | *(self)* | — | `order_shipped` |
| `delivered` — buyer confirmed receipt | `screen` (own action) | **I** — "Order completed" | — | — | `order_delivered` |
| `delivered` — staff marked | **I** — "Marked delivered — problem? contact us" | **I** — "Order completed" | *(self)* | — | `order_delivered` |

The buyer's email-classic events (`placed`, `shipped`) are `I`-only in v1; they become the
first candidates for the deferred email layer.

### 3.2 Cancellation events

| Event | Buyer | Seller (login) | Staff | Login-less seller | `Notification.type` |
|---|---|---|---|---|---|
| request raised | `screen` (the #10 §6.2 banner) + **I** — shows `autoApproveAt` | **I** — "Cancellation requested — your decision" | admin **Pending cancellations** list (#10 §6.5) | staff act | `cancellation_requested` |
| auto-approve warning, at `autoApproveAt − 2 days` | — | **I** — "Auto-approves in 2 days — act now or it is approved" | *(the list, sorted by `autoApproveAt`)* | staff act | `cancellation_warning` |
| approved by seller | **I** — "Cancellation approved — order cancelled, item re-listed" | `screen` (own action) | *(admin lists)* | n/a | `cancellation_approved` |
| approved by staff | **I** | **I** — "Staff approved a cancellation on your order" | *(self)* | n/a | `cancellation_approved` |
| approved automatically (7 days) | **I** | **I** — "Cancellation auto-approved (not actioned in time)" | *(the list)* | n/a | `cancellation_approved` |

- The **warning** is a single in-app notification to the **seller-with-login only**, once per
  `CancellationRequest`. It is emitted by the **same daily Vercel Cron sweep** that does the
  auto-approve (#10 §6.5), and, as a safety net, lazily on read of the order/admin list.
- `cancellation_approved` copy varies by recipient and by `resolvedBy` (`seller` / `staff` /
  `auto`); the type is one value, the subject carries the detail.
- **No staff `Notification`** on any row — including "approved by seller". Staff observe
  resolution through the Pending-cancellations list and the order record.

### 3.3 New messages

Unchanged from [messaging model (#11) §6](./messaging-model.md): a message the recipient has
not seen is **unread via `Message.readAt`**, surfaced as the per-thread and nav-level count on
the buyer **Messages** area and the seller-center **Messages** section. **No `Notification`
row, no email in v1.** (The deferred email layer adds a guarded "one unread-message email per
thread until read" rule — recorded here so it is not re-litigated.)

Staff are not a conversation party (#11 §6); message events never notify staff. Thread
**reports** continue to go to the staff **report queue** (#11 §7), which is not a
`Notification`.

---

## 4. Staff and login-less sellers

**Staff** get no feed and no email. Everything they must act on is a list in the admin tool:

| Staff needs to act on | Admin-tool surface |
|---|---|
| a new `placed` order (confirm with the seller) | Orders list, "needs confirmation" filter (`status = placed`) |
| a pending cancellation (backstop approver; sole approver for login-less sellers) | **Pending cancellations** list (#10 §6.5), sorted by `autoApproveAt` |
| a reported thread | **report queue** (#11 §7) |

**Login-less sellers** get nothing automated. Staff act on their orders and cancellations and
contact them out-of-band (phone / the contact email staff hold) as an operational step — the
white-glove model, unchanged. "Automated email to a login-less seller" is part of the
deferred email layer (§1), not a v1 feature.

---

## 5. The notification feed

One per user with a `buyer` or `seller` role.

- **Buyer** — a bell / **Activity** item in the site header, with an unread count. Opens a
  reverse-chronological list of the buyer's `Notification` rows: icon by `type`, one line of
  copy, relative time, links to the subject (order detail page).
- **Seller-with-login** — the same feed as a **Notifications** item in the seller center,
  linking to the seller-center order detail (#13 §3.2).

**Read semantics:**

- Opening the **subject** marks every unread `Notification` for that subject and user read
  (opening order `ORD-000123` clears its `order_*` and `cancellation_*` rows).
- The feed has **"Mark all as read"**.
- The unread **count** = `Notification` rows for the user with `readAt = null`.
- Message unread is **separate** and stays on the #11 mechanism — the feed does not show
  message events, and the Messages badge does not count `Notification` rows.

There is no "clear" / delete for a single notification in v1 (read is enough); no pagination
beyond a simple "older" control; rows are kept indefinitely (volume is tiny).

---

## 6. What each downstream area now owns / must change

- **[Seller center (#13)](./seller-center.md)** — gains a **Notifications** feed item. Its
  §2 "Nav badges: the Messages item carries the #11 unread count. No other nav badge in v1"
  becomes **"Messages unread + Notifications unread"**. The feed is complementary to the
  Overview tiles: tiles show *current* counts (open orders, pending cancellations), the feed
  shows the *event stream*. Recorded as a note on PR #18 rather than edited on that unmerged
  branch.
- **[Order model (#10)](./order-model.md)** — the DAL transition functions (§3 table) each
  additionally write `Notification` rows in the same transaction; the §6.5 cron additionally
  emits the `cancellation_warning`. No lifecycle or field change.
- **[Auth (#12)](./auth-and-permissions.md)** — its §6 "no transactional email" is **upheld
  and extended** to notifications. The auth-event messaging it flagged as depending on us
  ("your password was reset", "your seller login is ready") stays **staff-relayed in person**
  in v1 (the seller has no login yet when provisioned, so an in-app feed cannot reach them);
  it folds into the deferred email layer.
- **Deferred: the transactional-email layer** — auth + order + cancellation + message email
  as one later effort (§1). Includes the EU-region provider + SPF/DKIM infra requirement and
  the guarded new-message-email rule (§3.3).
- **[`docs/domain-model.md`](./domain-model.md)** and [`CONTEXT.md`](../CONTEXT.md) — the
  `Notification` entity and term are added on this branch.

---

## 7. ADR

**"v1 notifications are in-app only; transactional email is deferred as one layer."** —
[ADR-0008](./adr/0008-in-app-notifications-email-deferred.md). A real trade-off (a marketplace
normally emails buyers when an order ships), mildly surprising to a future reader, and while
each half is cheap to reverse the *shape* — a durable in-app `Notification` record as the
system of record, with email as a later additive channel — is worth recording.
