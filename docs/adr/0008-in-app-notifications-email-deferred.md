# ADR-0008 — v1 notifications are in-app only; transactional email is deferred as one layer

- **Status:** accepted
- **Date:** 2026-09-06
- **Source:** [#17 Notifications](https://github.com/Lucy-yunn/test/issues/17) · full matrix in [`docs/notifications.md`](../notifications.md); builds on [#12 §6](../auth-and-permissions.md)

## Context

Both [#10](https://github.com/Lucy-yunn/test/issues/10) (orders) and [#11](https://github.com/Lucy-yunn/test/issues/11) (messaging) deliberately specified only their own *in-app* state and deferred the cross-cutting notification policy. [#12 §6](../auth-and-permissions.md) had already ruled that **v1 ships no transactional email** — no provider is in the stack and every demo user is fictional or personally onboarded. A normal marketplace emails the buyer when an order ships; the question was whether to add a provider now for the order/cancellation events.

An early grilling pass leaned toward a short email nudge list; it was reversed once [#12](https://github.com/Lucy-yunn/test/issues/12) closed having ruled a provider out.

## Decision

**The entire v1 notification mechanism is a durable in-app `Notification` record plus a per-user feed. No email of any kind. Email is deferred as a single later layer.**

- **`Notification`** — one row per notifiable event per recipient with an in-app surface (`buyer` or `seller`-with-login; **never staff**). Fields: `userId`, `type` (7 values across order + cancellation events), `subjectType` (`order` | `cancellation_request`) + `subjectId`, `createdAt`, `readAt`. **No channel columns, no preferences** — every notification is transactional.
- **Order + cancellation events only.** New-message alerting stays entirely on [#11](https://github.com/Lucy-yunn/test/issues/11)'s `Message.readAt` — no `Notification` row (it would double-count against the Messages badge).
- **Rows are written by the DAL transition functions in the same transaction as the state change**, plus the [#10 §6.5](../order-model.md) cron for the T−2-day auto-approve warning.
- **A per-user feed** (bell / Activity for buyers, a Notifications item in the seller center) with an unread count, cleared by opening the subject or "mark all read".
- **Staff get no feed and no rows** — they work from admin-tool lists ("needs confirmation" orders, Pending cancellations, the report queue).
- **Login-less sellers get nothing automated** — staff contact them out-of-band (the white-glove model, unchanged).

**Deferred as one effort:** email for auth events (password reset done, seller login ready), order events (buyer `placed` / `shipped` first), cancellation events, and new messages (with a guarded "one unread-message email per thread until read" rule) — added together later with an EU-region provider (SPF/DKIM), wiring Better Auth's scaffolded email hooks. **`Notification` rows are the seam the email layer hangs off.**

## Consequences

**Positive**
- One table, one feed, no per-channel delivery tracking, no preferences screen.
- The `Notification` record is the **system of record** for "this event happened and was surfaced" — email, when it comes, is an additive channel, not a rewrite.
- Nothing half-builds email; there is no dead provider config in v1.

**Negative / trade-offs**
- A buyer who isn't looking at the site doesn't find out their order shipped until they return — normal for a demo, not acceptable for a live marketplace, hence the deferred layer is a known near-term follow-up.
- "Your seller login is ready" cannot reach a just-provisioned seller in-app (they have no session yet) — it stays a staff-relayed step until the email layer lands.

## Alternatives considered

- **Add an email provider now for order/cancellation events** — rejected: [#12](https://github.com/Lucy-yunn/test/issues/12) ruled a provider out for v1, and a demo with fictional recipients has no one to email.
- **In-app only, no durable record** (just render state on screens) — rejected: a buyer needs a place to see "what changed since I last looked", and the durable row is what the email layer will later read from.
- **A `Notification` row for new messages too** — rejected: double-counts against the [#11](https://github.com/Lucy-yunn/test/issues/11) Messages badge; `Message.readAt` already does the job.
