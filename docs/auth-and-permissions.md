# v1 Auth, Roles & Permissions

Resolves [Auth, roles & permissions (#12)](https://github.com/Lucy-yunn/test/issues/12)
on the [Wayfinder map (#1)](https://github.com/Lucy-yunn/test/issues/1).

Builds on [Core domain model (#2)](https://github.com/Lucy-yunn/test/issues/2) (the party
model — `User` / `Buyer` / `Seller` / `staff`) and the architecture baseline
([draft ADR-0001](./adr/0001-architecture-baseline.md); auth checks in the Data Access Layer).
Vocabulary is governed by [`CONTEXT.md`](../CONTEXT.md); the entity/field skeleton lives in
[`docs/domain-model.md`](./domain-model.md). This document owns **the auth engine
configuration, the buyer self-registration flow, the seller account-provisioning flow, the
staff account model, the full permission matrix across the three surfaces, and where each rule
is enforced** — the procedural detail the domain model defers.

---

## 1. Scope

Three **roles**, exactly one per `User` in v1 (locked in #2): `buyer`, `seller`, `staff`.

| Role | Profile entity | Created by | Login |
|---|---|---|---|
| `buyer` | `Buyer` (1:1, required) | self-registration | always |
| `seller` | `Seller` (1:1, **optional**) | staff, at onboarding | provisioned by staff later, or never |
| `staff` | none | seed script (by hand) | always |

Out of this ticket:
- **Notifications** (email / push, and whether a login event should notify) — map fog, the
  dedicated [notifications ticket (#17)](https://github.com/Lucy-yunn/test/issues/17).
- **The admin-tool and seller-center screen layouts** — owned by
  [Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13) and the final spec
  assembly. This document fixes the permissions those screens operate within.
- **Self-serve seller listing** — out of scope for v1 (map). Sellers never create or edit
  listings; that is staff-entry only.
- **Social login** — Google / Facebook buttons are rendered **disabled** in v1 (Q21); no
  provider is wired.

---

## 2. Auth engine

**Better Auth** (settled on the map; the Auth.js line in draft ADR-0001 is stale and is to be
corrected when that ADR is finalised), email + password, Prisma adapter, session in an
`httpOnly` / `secure` / `sameSite=lax` cookie, verified in the DAL.

### 2.1 The `admin` plugin

Better Auth's `admin` plugin is a near-exact fit for "staff manage other users" and supplies
`createUser`, `setRole`, `listUsers`, `banUser` / `unbanUser`, `removeUser`, and session
revocation server-side without an email round-trip. v1 uses it with:

- **Custom roles** `buyer | seller | staff` — declared through the **minimal
  access-control setup the plugin requires** (`createAccessControl()` with a small statement
  and one role object per role). This is a plugin-wiring requirement, **not** the application's
  authorization model — see §2.2.
- `adminRole: "staff"` — `staff` is the administrative role for every plugin operation.
- `defaultRole: "buyer"` — a self-registered `User` is a `buyer`.
- **No impersonation UI.** `impersonateUser` is not surfaced anywhere in v1.
- Session defaults kept: **7-day sliding expiry** (refreshed daily). No "remember me" toggle.
- Better Auth's built-in **rate limiting** stays on for the auth endpoints; nothing custom.

### 2.2 Authorization lives in the DAL, not in Better Auth ACL

The `admin` plugin's access-control roles exist only to satisfy the plugin. **Every
application authorization decision — the whole permission matrix in §7 — is made in our Data
Access Layer**, next to `verifySession()`, per draft ADR-0001. We do not route app
authorization through Better Auth's `hasPermission` / statement checks. Rationale: a 3-role
app needs role checks and ownership checks, not a resource/action ACL, and keeping one
authorization mechanism (the DAL) avoids two sources of truth.

---

## 3. Buyer self-registration

### 3.1 The form

`/register` (buyer-only — there is no seller or staff self-registration). Fields:

| Field | Required | Notes |
|---|---|---|
| `email` | yes | unique across all `User` rows |
| `password` | yes | Better Auth default policy (min 8 chars) |
| `name` | yes | the person's full name (`User.name`) |
| Terms & Privacy checkbox | yes | must be ticked to submit; links to the placeholder legal pages (#9) |

**No delivery address at registration** — it is collected at checkout and editable in settings
(#10 §4). Social-login buttons are shown **disabled**.

### 3.2 What happens on submit

1. A `User` (`role = buyer`) **and** its `Buyer` profile row are created **atomically, in one
   database transaction**, through an **explicit transactional signup path** in the DAL.
   - **Not** via a Better Auth `databaseHooks.user.create.after` hook: current Better Auth
     after-hooks run *after* the signup transaction has committed, so a failure creating the
     `Buyer` would leave an orphan `User`. The spec requires `User` + `Buyer` consistency; the
     build must guarantee it with a real transaction (wrap Better Auth's user creation and the
     `Buyer` insert together, or create the `Buyer` in a `before` hook / same-transaction
     callback — an implementation choice, but the atomicity is not optional).
2. The buyer is **auto-signed-in**.
3. Redirect: to the **gated action** the buyer came from (the listing they clicked **Buy** /
   **Favorite** / **Message seller** on), else the homepage. There is nothing to "merge" — an
   anonymous visitor has no favourites, orders, or threads to carry over; funnel state is just
   URL parameters.

### 3.3 Buyer settings (self-service)

`/account/settings`.

| Field | Buyer can change it? |
|---|---|
| `name` | ✅ |
| `password` | ✅ — requires the current password |
| saved delivery address (the 7 fields, #10 §4) | ✅ |
| `email` | ✗ — no verification path in v1; screen shows "Contact us to change your email" |
| delete account | ✗ — no self-serve deletion in v1 (see §9) |

---

## 4. Seller account provisioning (staff-driven)

A Seller is onboarded white-glove. Provisioning is **two phases**, and phase 2 is optional.

### 4.1 Phase 1 — create the `Seller` profile (always)

Staff open **New seller** in the admin tool and enter:

- `displayName` (shown to buyers)
- contact name / contact email / contact phone (staff-facing)
- the embedded **Location** — name, address line, city, postcode, country (one per Seller, #2)

**No `User` is created.** Staff can immediately enter `DonorVehicle`s and `Listing`s against
this Seller. Their published listings appear on the buyer site (displayName + Location city /
country). Because `Seller.userId` is unset, the listing page shows *"Messaging isn't available
for this seller"* instead of a **Message seller** button, and no `Thread` can be created
(#11 §2). This is a **login-less seller**.

### 4.2 Phase 2 — provision a login (optional, any time)

On the Seller page, staff click **Provision login** and enter a **login email**
(pre-filled from the contact email, editable). Then:

1. **Collision check** — if that email already belongs to **any** `User` (a buyer, another
   seller, or staff), provisioning is **rejected** with *"This email already has an account"*.
   Staff must use a different email. See the v1 limitation in §8.
2. If the email is free: a `User` (`role = seller`) is created, `Seller.userId` is linked
   (1:1), and the system **generates a random initial password and displays it once** to the
   staff member, who relays it to the seller personally (white-glove; there is no email — §6).
3. The password is **not** force-rotated on first login. The seller center has a
   **Change password** page.

Once linked, the seller can sign in to the (mostly read-only) seller center and use its two
write actions (§7).

### 4.3 Managing an existing seller login

Staff actions on a Seller that has a login:

| Action | Effect |
|---|---|
| **Disable login** | Better Auth ban — the seller cannot sign in. `Seller` profile, listings, orders, and message history are untouched. Reversible via **Enable login**. |
| **Unlink login** | Clears `Seller.userId` **and** disables that `User` (never a hard delete). For the "provisioned the wrong / a mistaken account" case. The Seller reverts to login-less behaviour on the buyer site. |
| **Reset password** | Generates a new random password shown once to staff to relay. Works on any `User` (§6). |

A disabled or unlinked seller login simply makes the Seller behave as login-less again
(no messaging).

---

## 5. Staff accounts

- Created by a **committed seed script** (`prisma/seed` path), **one named `User`
  (`role = staff`) per founder** — not a shared login, so every admin action is attributable.
  Initial credentials come from environment variables.
- **No staff-management UI, no staff self-registration, no invite flow.** A third staff member
  (if ever needed) is added by re-running the script.
- The admin tool can provision **seller** logins (§4.2) but **cannot create `staff`**.
- Staff have **no profile entity** (#2) — just `User.role = staff`.

---

## 6. No transactional email in v1

v1 sends **no transactional email** (no provider is in the stack; every user in the demo is
fictional or personally onboarded). Consequences, all deliberate:

- **Buyer registration** takes effect immediately — no verification step / no "verify your
  email" gate.
- **Password reset** is a **staff action** in the admin tool (**Reset password**, §4.3) —
  staff generate a new password and relay it. The login page has **no "Forgot password?"
  link**; instead a line: *"Trouble signing in? Contact us."*
- **Seller login credentials** are set by staff and handed over personally (§4.2).

This is a **spec note, not an ADR** — it is cheap to reverse (add a provider and wire Better
Auth's existing email hooks) and unsurprising for a seed-data demo. Better Auth's email hooks
are left scaffolded but unwired.

---

## 7. Permission matrix

Audiences: **Anonymous** (no session) · **Buyer** (`role = buyer`) · **Seller** (`role =
seller` **with `Seller.userId` set**) · **Staff** (`role = staff`).

### 7.1 Buyer-facing site (`/`, `/account/*`)

| Capability | Anonymous | Buyer | Seller | Staff |
|---|---|---|---|---|
| Funnel, search, browse, listing detail, policy / footer pages | ✅ | ✅ | ✅ | ✅ |
| Place an Order (**Buy**) | → login | ✅ | ✗ disabled | ✗ disabled |
| Favorite / unfavorite a listing | → login | ✅ | ✗ | ✗ |
| Start / reply in a `Thread` (**Message seller**) | → login | ✅ *(if the seller has a login)* | ✗ *(no button)* | ✗ |
| View **my orders** / order detail | — | ✅ own only | — | — |
| Cancel own order (raise a `CancellationRequest`, pre-ship) | — | ✅ own | — | — |
| Confirm receipt (`shipped → delivered`) | — | ✅ own | — | — |
| Report a `Thread` | — | ✅ own threads | ✅ own threads | — |
| Settings — edit `name` / `password` / delivery address | — | ✅ | — | — |
| Change `email` / delete account | — | ✗ *(contact staff)* | — | — |

"→ login" = the action is visible but sends an anonymous user through `/login` (or
`/register`) and back. `seller` / `staff` accounts see **Buy** and **Message seller** rendered
disabled with a short note ("Buying is for buyer accounts").

### 7.2 Seller center (`/seller/*`) — `role = seller` with a login only

| Capability | Access | Source |
|---|---|---|
| View own listings + product-performance metrics | read | metrics owned by #13 |
| View own orders — full delivery-address snapshot, buyer phone, cancellation reason | read | [order-model.md §11](./order-model.md) |
| See `DonorVehicle` data | read — **only where it surfaces through the seller's own Listings / listing detail, or another surface #13 defines**; no standalone `DonorVehicle` view is mandated here | this ticket + #13 |
| **Messages** — reply in `Thread`s | **write** | [messaging-model.md §5](./messaging-model.md) |
| **Approve** a pending `CancellationRequest` on own order | **write** | [order-model.md §6.3](./order-model.md) |
| Change own password | write | §4.2 |
| Create / edit / price listings; **initiate** a cancellation; see any other seller's data | ✗ | staff-entry only in v1; `CancellationRequest.requestedBy` is `buyer \| staff` |

The seller center is **read-only except for two write actions**: replying to messages, and
approving a pending cancellation on one's own order. (This corrects
[messaging-model.md](./messaging-model.md) §5, which describes messaging as "the one write
action" — there are two once merged #10 §6.3 is accounted for.)

### 7.3 Admin tool (`/admin/*`) — `role = staff` only

English-only (no translated copy; still under `[locale]` for routing uniformity).

| Area | Staff |
|---|---|
| **Sellers** — create profile, edit, **provision / unlink login**, **reset password**, **disable / enable login** | ✅ |
| **Buyers** — view, **reset password** | ✅ |
| **Parts / PartNumbers** — full CRUD, `partStatus` transitions, merges | ✅ |
| **Listings / DonorVehicles** — full CRUD, publish checklist, `status` transitions | ✅ |
| **Orders** — confirm, mark shipped (enter `trackingNumber` + `expectedTimeRange`), mark delivered, enter `shippingCostEur` / `shippingNotes` | ✅ |
| **Cancellations** — approve any, raise one on a seller's behalf, "Pending cancellations" list | ✅ |
| **Threads** — read any, post as **IVO Support**, lock / unlock, resolve the report queue | ✅ |
| **Block** a `User` from messaging (`messagingBlockedAt`) | ✅ |
| **Vehicle catalogue** — add `VehicleMake` / `VehicleModelGroup` / `VehicleGeneration` during intake | ✅ |
| Create other **`staff`** accounts | ✗ — seed script only (§5) |
| Impersonate any user | ✗ — not built (§2.1) |

Staff work happens entirely in `/admin`; staff have **no access to the seller center** (they
see every seller's data in the admin tool).

---

## 8. One role per `User` — the v1 rule and its limitation

- **Structural:** `User.role` is a single required enum, not a set and not a join table. No
  code path grants a second role.
- **Enforced at provisioning:** the seller-login provisioning function (§4.2) rejects an email
  already held by any `User`.
- **The limitation (documented):** *a human who is both a buyer and a seller cannot use one
  email for both. If an email already belongs to a `buyer` `User`, staff cannot provision a
  `seller` login with that same email — a second email is required.* There is no
  buyer→seller conversion and no role switching in v1.
- **ADR candidate:** *"One role per `User` in v1"* is logged for the **final spec assembly**
  ADR set — it is hard to reverse, surprising to a future reader, and a real trade-off against
  a future marketplace where the same person acts as both buyer and seller. Not written now.

---

## 9. Account deletion / data erasure

No self-serve account deletion in v1. A real erasure flow (GDPR-style right-to-be-forgotten,
which matters for an EU business) is **post-v1 / map fog** — it interacts with retained
`Order` history, `Message` immutability (#11 §4), and the login-less `Seller` model, none of
which v1 needs to solve for a fictional-user demo.

---

## 10. Enforcement

Per draft ADR-0001: **auth checks live in the DAL and in every Server Action — not in
layouts.**

| Layer | Responsibility |
|---|---|
| **`proxy.ts`** (Node runtime) | *Optimistic* cookie-only redirect: an unauthenticated request to `/account/*`, `/seller/*`, or `/admin/*` → `/login?redirect=<path>`. The cookie is **not verified** here — this is a UX shortcut, **not** a security boundary. |
| **DAL — `verifySession()`** | Runs on every authenticated read path; memoised per request (`cache()`); returns a typed session or `null`. `null` on a protected path → redirect to `/login`. |
| **DAL — role guards** | `requireBuyer()` / `requireSeller()` / `requireStaff()` at the top of every data function **and** re-checked inside **every** Server Action. A wrong-role **authenticated** request (e.g. a signed-in buyer opening `/admin`) → a plain **403 page** (not a redirect, not a 404). |
| **DAL — ownership checks** | `Order.buyerId` / `Order.sellerId` match the session; `Thread` party check; `Seller.userId === session.userId` for all seller-center data; a buyer reads only their own `Buyer`. |
| **DAL — `role = buyer` gate** | specifically on: create `Order`, create `Favorite`, create `Thread` / `Message` as a buyer, create `CancellationRequest` as a buyer. |
| **DAL — messaging block** | `User.messagingBlockedAt` checked on every `Thread` / `Message` write (#11 §7). |
| **Schema** | `User.role` single required enum (the one-role rule, §8); FKs and 1:1 constraints on `Buyer.userId` / `Seller.userId`. |

Login page topology: **one `/login`** for all roles → post-auth redirect by role (`staff` →
`/admin`, `seller` → `/seller`, `buyer` → `redirect` param or `/`). **One `/register`**,
buyer-only.

---

## 11. Downstream / fog touched by this ticket

- **[Seller center (#13)](https://github.com/Lucy-yunn/test/issues/13)** — consumes this
  matrix; owns the seller-center screens and the exact performance metrics, and decides
  whether a standalone `DonorVehicle` view exists (§7.2).
- **[Notifications (#17)](https://github.com/Lucy-yunn/test/issues/17)** — any "your password
  was reset" / "your seller login is ready" messaging depends on the notification channel
  decision and on whether transactional email lands.
- **[Messaging model (#11)](https://github.com/Lucy-yunn/test/issues/11)** — its §5 "one write
  action" wording needs to become "two" (messaging **and** cancellation approval). Noted on
  PR #16 rather than edited on that unmerged branch.
- **Draft [ADR-0001](./adr/0001-architecture-baseline.md)** — the "Auth.js (NextAuth v5)" line
  should read **Better Auth** when the ADR is finalised.
- **Final spec assembly** (map fog) — the *"One role per `User` in v1"* ADR (§8); the admin
  tool and seller center screen inventories.
