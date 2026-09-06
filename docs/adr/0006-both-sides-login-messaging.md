# ADR-0006 — Messaging requires a login on both sides; no staff relay

- **Status:** accepted
- **Date:** 2026-09-06
- **Source:** [#11 In-app messaging model](https://github.com/Lucy-yunn/test/issues/11) §2 · full spec in [`docs/messaging-model.md`](../messaging-model.md)

## Context

v1 has in-app 1:1 buyer↔seller messaging (Q26/Q27). But sellers are onboarded white-glove and a `Seller.userId` (a seller-center login) is **optional** — staff may provision one later, or never ([#2](https://github.com/Lucy-yunn/test/issues/2), [#12](https://github.com/Lucy-yunn/test/issues/12)). So some listings belong to sellers with no login. How does a buyer message them?

The obvious option is a **staff relay**: the buyer messages, staff forward it to the seller by phone/email and relay the reply back.

## Decision

**A `Thread` can exist only when both parties have a real login. There is no staff relay.**

- **Buyer** — must be registered and signed in (`role = buyer`). An anonymous visitor who clicks **Message seller** is sent through register/login and returned to the listing.
- **Seller** — must have `Seller.userId` set. For a **login-less seller**, the listing page shows *"Messaging isn't available for this seller"* in place of the button, and **no `Thread` can be created**.
- Staff can post into any existing `Thread` as a labelled **"IVO Support"** entry (moderation / intervention), but they do **not** carry messages to or from a login-less seller.
- Demo messaging coverage therefore tracks exactly which sellers have been given a login — the seed-data plan must provision at least one.

## Consequences

**Positive**
- Every `Thread` is a direct, attributable, two-party conversation. `senderRole` + `senderUserId` are always a real logged-in person.
- Staff are never a synchronous dependency on routine buyer questions.
- No "who actually said this" ambiguity, and no half-built relay tooling.

**Negative / trade-offs**
- Listings from login-less sellers carry **no buyer contact channel at all** — a real limitation, accepted for v1 (the white-glove model means staff are already in the loop on those sellers operationally).
- Pushes staff toward provisioning seller logins sooner, which is the intended direction anyway.

## Alternatives considered

- **Staff relay for login-less sellers** — rejected: makes staff a message queue on every listing, blurs attribution, and is throwaway work once the seller gets a login.
- **Let the buyer message and hold it until the seller has a login** — rejected: unbounded wait, no delivery guarantee, and the buyer isn't told their message is going nowhere.
