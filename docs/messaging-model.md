# v1 In-App Messaging Model

Resolves [In-app messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

Builds on [Core domain model (#2)](https://github.com/Lucy-yunn/test/issues/2). Vocabulary is
governed by [`CONTEXT.md`](../CONTEXT.md); the entity/field skeleton lives in
[`docs/domain-model.md`](./domain-model.md). This document owns **who can message whom, the
surfaces each role uses, the Thread/Message rules, unread state, and moderation** — the
procedural detail the domain model defers.

---

## 1. Scope

v1 messaging is **in-app, 1:1, buyer↔seller, text-only** chat (Q26/Q27). One conversation is a
**`Thread`**, scoped to one **Listing** and one **Buyer** (locked in #2: unique
`(listingId, buyerId)`, also carrying `sellerId`). It is not real-time — the client refreshes
/ polls; there is no websocket requirement.

Out of this ticket:
- **Email / push notifications** and the **cross-event notification policy** (order status,
  cancellation events, new messages, as one design) — a dedicated
  [notifications ticket](https://github.com/Lucy-yunn/test/issues/1) graduated from the map
  fog. This document specifies only the **in-app unread state** (§6).
- The **seller center** and **admin tool** *screen layouts* — owned by
  [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13) and the final spec
  assembly. This document fixes the messaging data and rules those screens act on.
- **Attachments** (photos in a Thread) — deferred (§4).

---

## 2. Who can message — both sides must be logged in

A Thread can exist **only when both parties have a real login**:

- **Buyer** — must be registered and signed in. Messaging requires a `Buyer` profile (1:1 with
  a `User`, auto-created on self-registration — #2). An anonymous funnel visitor who clicks
  **Message seller** is sent through register / login first, then returned to the listing.
- **Seller** — must have `Seller.userId` set (a seller-center login provisioned — #2, #13).
  For a seller **without** a login, the listing page shows *"Messaging isn't available for
  this seller"* in place of the **Message seller** button, and **no Thread can be created**.

**There is no staff relay.** Staff do not forward messages to or from a login-less seller.
Messaging coverage in the demo therefore tracks exactly which sellers have been given a login.

Rationale (founder's call): a relay makes staff a synchronous dependency on every buyer
question and blurs who said what. Requiring a login on both sides keeps every Thread a direct,
attributable, two-party conversation. The trade-off — listings from login-less sellers carry
no buyer channel — is accepted for v1. **This is an ADR candidate for the final spec
assembly** (alongside the #7 search-union and #10 cancellation-policy ADRs).

---

## 3. Threads

### 3.1 Every Thread is triggered by a Listing

The buyer opens a Thread **from a specific listing page** — never a generic "contact this
seller". There is no per-seller inbox conversation: a buyer talking to one seller about three
listings has **three** Threads. This keeps `(listingId, buyerId)` a true unique key and means
every message exchange has an unambiguous subject.

### 3.2 Starting a Thread

| Precondition | Rule |
|---|---|
| Listing status | `published` or `reserved` (the buyer-visible states — #8). Not `draft` / `sold` / `cancelled` / `archived`. |
| Seller | has `Seller.userId` set (§2) |
| Buyer | signed in with `role = buyer` (a `seller` / `staff` account sees no **Message seller** button) |
| Existing Thread | if a Thread for this `(listing, buyer)` already exists, **Message seller** re-opens it rather than creating a second |

The first message and the Thread are created together — an empty Thread is never persisted.

### 3.3 The pinned listing header

The Thread view (both sides) shows a **live listing header** at the top at all times: primary
photo, auto-composed title, `priceEur`, and the Listing's **current `status`**. It reads
**through to the retained Listing** (the Listing row is never deleted — same mechanism as the
order detail page, #10 §10.3), so it keeps rendering after the Listing leaves browse.

When the Listing is no longer available to this buyer, the header shows a badge:

| Listing status | Header badge |
|---|---|
| `published` | *(none)* |
| `reserved` | **Reserved** — *by this buyer*: "You've reserved this item"; *by someone else*: "Reserved by another buyer" |
| `sold` | **Sold** |
| `cancelled` / `archived` | **No longer listed** |

### 3.4 Thread lifecycle

- A Thread **never auto-closes**. It stays open through every later change of the Listing's
  status — after the item sells (to this buyer or another), buyer and seller can still message
  (delivery coordination, "do you have another?").
- The **only** closed state is a **staff lock** (§7). A locked Thread accepts no new messages
  from buyer or seller; both see *"This conversation was closed by IVO."*
- Threads are ordered by `lastMessageAt` (most recent first) in every list.
- **Placing an order does not auto-create a Thread** (locked in #10). The order detail page's
  **Message seller** link opens or re-uses the same `(listing, buyer)` Thread.

---

## 4. Messages

A **`Message`** is one entry in a Thread.

| Field | Type | Notes |
|---|---|---|
| `threadId` | FK → Thread, required | |
| `senderRole` | enum, required | `buyer \| seller \| staff` — stored explicitly, not derived |
| `senderUserId` | FK → User, required | the actual sender; always present (all three roles are logged-in Users) |
| `body` | text, required | plain text, **~4000 char** cap; non-empty |
| `sentAt` | timestamp, required | |
| `readAt` | timestamp, nullable | set when the *other* party first opens the Thread after this message (§6) |

- **Text only.** No photo / file attachments in v1. A buyer who wants more images asks the
  seller to add them **to the Listing**, where they help every buyer; this also avoids the
  per-Thread blob storage the Listing model (#8) was careful about. Attachments are a later
  enhancement.
- **Immutable.** No edit, no delete — by the sender, the seller, or staff. A Thread is an
  append-only log. Moderation acts by **locking** and **blocking** (§7), never by rewriting
  history.
- **`senderRole` is stored, not derived** from `User.role`: cheap to render, and correct even
  if a person's role were ever changed later.

### Staff messages

Staff can post into any Thread (§7). A staff message has `senderRole = staff` and renders to
**both** buyer and seller as a visually distinct **"IVO Support"** entry — **never** styled as
or attributed to the seller. This is the only way an operator can intervene in a live
conversation; it is expected to be rare.

---

## 5. Surfaces

| Role | Reads / writes where | Notes |
|---|---|---|
| **Buyer** | a dedicated **Messages** area (all their Threads, newest first); a Thread is also opened from the **listing page** and from the **order detail page** | starts a Thread only from a listing page (§3.2) |
| **Seller** (with login) | a **Messages** section in the **seller center** | **the one write action in an otherwise read-only seller center** — a context note is on [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13) so it plans for a reply box |
| **Staff** | the **admin tool** — a Threads view listing every Thread, with the **report queue** (§7); can open any Thread, post as *IVO Support*, lock, and block | read access is unconditional — Threads are not private from the operator |

### Identity shown

- The **buyer** sees the seller's **`displayName`** only — never contact details or the
  Location address (consistent with #10 §11).
- The **seller** sees the buyer's **name** (the `User.name`). The delivery address / phone is
  an **order** disclosure (#10), not a messaging one.
- Staff see both real identities.

---

## 6. Unread state (in-app only)

The single mechanism is **`Message.readAt`**:

- A Message is **unread** for the counterparty until they next open the Thread; opening the
  Thread stamps `readAt` on every previously-unread Message addressed to them.
- **Thread unread count** = messages in the Thread not sent by the viewer and with
  `readAt = null`.
- Badges, driven by that count:
  - **Buyer** — a count on the **Messages** nav item, and per-Thread in the list.
  - **Seller** — a count on the seller-center **Messages** item, and per-Thread.
  - **Staff** — the admin **Threads** view flags Threads with an open **report**; a global
    unread badge is optional (staff are not a conversation party by default).

**No email, no push, no digest** in v1 — those, and whether a new message should notify at all
when the recipient is offline, are the dedicated notifications ticket's to decide.

---

## 7. Moderation & abuse (v1)

Deliberately minimal and **entirely staff-driven** — no automated content filtering, no
keyword blocking, no off-platform-contact policing (the checkout is stubbed; there is no
payment to protect yet).

| Lever | Who | Effect |
|---|---|---|
| **Report** | buyer or seller, on a Thread | raises the Thread in the admin **report queue** with the reporter and an optional short reason; does not change the Thread |
| **Read any Thread** | staff | unconditional (§5) — the whole v1 review mechanism |
| **Post as IVO Support** | staff | a labelled message into any Thread (§4) |
| **Lock a Thread** | staff | no further messages from buyer or seller; both see *"closed by IVO"*; reversible by staff |
| **Block a User from messaging** | staff | that `User` cannot **start** or **reply to** any Thread anywhere; existing Threads become read-only for them; a `messagingBlockedAt` flag on `User` (or a small block record — a build decision) |

No message deletion or redaction (§4). No buyer/seller ability to delete a Thread — a buyer
who wants one gone simply stops replying.

---

## 8. Entities

### Thread

| Field | Type | Notes |
|---|---|---|
| `listingId` | FK → Listing, required | the subject listing |
| `buyerId` | FK → Buyer, required | |
| `sellerId` | FK → Seller, required | denormalised from the Listing (nearly every query is "threads for this seller") |
| `createdAt` | timestamp, required | = the first message's `sentAt` |
| `lastMessageAt` | timestamp, required | ordering key; updated on every new message |
| `lockedAt` | timestamp, nullable | staff lock (§7) |
| `lockedBy` | FK → User (staff), nullable | |

- **Unique `(listingId, buyerId)`** (locked in #2).
- Invariant (DAL, per #2's "behavioural invariants → the DAL"): `Thread.sellerId ==
  Listing.sellerId` at creation.

Relationships: → 1 `Listing`, → 1 `Buyer`, → 1 `Seller`, → many `Message`.

### Message

Fields in §4.

Relationships: → 1 `Thread`, → 1 `User` (`senderUserId`).

Invariants (DAL):
- a `Message` may be created only if the Thread is **not** locked and the sender is **not**
  messaging-blocked;
- `senderRole` is `buyer` / `seller` matching the Thread's parties, or `staff`;
- `body` is non-empty after trim and within the length cap;
- `Message` rows are never updated after creation except `readAt` (null → timestamp, once).

### Report

A lightweight flag, not a conversation.

| Field | Type | Notes |
|---|---|---|
| `threadId` | FK → Thread, required | |
| `reportedBy` | FK → User, required | buyer or seller party of the Thread |
| `reason` | text, nullable | optional short free text |
| `createdAt` | timestamp, required | |
| `resolvedAt` | timestamp, nullable | staff clears it from the queue |
| `resolvedBy` | FK → User (staff), nullable | |

*(Whether this is its own table or a status on the Thread is a build decision; the rule is
that staff get a queue of reported Threads.)*

### User (messaging-related additions)

- `messagingBlockedAt` — timestamp, nullable. When set, the `User` cannot start or reply to
  any Thread (§7). (Or a dedicated block record — build decision.)

---

## 9. Downstream / fog touched by this ticket

- **Notifications** (graduated to its own ticket) — email vs in-app, across order status,
  cancellation events, and new messages, as one cross-cutting design. This ticket does in-app
  unread state only.
- **Seller center (#13)** — must plan a **Messages** section with a **reply box**; it is the
  one write action in the seller center. Context note added to the ticket.
- **Final spec assembly** (map fog) — the admin tool's Threads / report-queue screens; and an
  **ADR** for the "both sides logged in, no staff relay" decision (§2).
- **Attachments in Threads** — deferred; a later enhancement, tied to the same blob-storage
  concern as the Listing model (#8).
