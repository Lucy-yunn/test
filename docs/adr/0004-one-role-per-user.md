# ADR-0004 — One role per `User` in v1

- **Status:** accepted
- **Date:** 2026-09-06
- **Source:** [#12 Auth, roles & permissions](https://github.com/Lucy-yunn/test/issues/12) §8 · full spec in [`docs/auth-and-permissions.md`](../auth-and-permissions.md)

## Context

There are three roles: `buyer`, `seller`, `staff`. A person could plausibly be more than one — a mechanic who both sells parts and buys them. The party model ([#2](https://github.com/Lucy-yunn/test/issues/2)) gives each `User` an optional `Buyer` profile and an optional `Seller` profile, which structurally *could* both be attached to one `User`.

## Decision

**A `User` has exactly one `role`, a single required enum. There is no multi-role, no role switching, and no buyer→seller conversion in v1.**

- **Structural:** `User.role` is one enum value, not a set and not a join table. No code path grants a second role.
- **Enforced at provisioning:** the seller-login provisioning flow ([`docs/auth-and-permissions.md`](../auth-and-permissions.md) §4.2) **rejects a login email that already belongs to any `User`** — buyer, seller, or staff.
- **Documented limitation:** a human who is both a buyer and a seller **cannot use one email for both**. Staff provisioning a `seller` login for someone whose email is already a `buyer` `User` must use a second email.

## Consequences

**Positive**
- Every authorization check is a simple role check plus an ownership check — no role-resolution logic, no "acting as" UI, no ambiguity about which permissions apply.
- The permission matrix ([`docs/auth-and-permissions.md`](../auth-and-permissions.md) §7) has four clean audiences (Anonymous / Buyer / Seller-with-login / Staff).
- The seed-script staff model (one named `User` per founder) stays trivially attributable.

**Negative / trade-offs**
- A dual buyer+seller person needs two email addresses and two logins, and cannot see both sides in one session.
- A future marketplace where the same person routinely buys and sells would need a real multi-role or account-linking model — a migration, not a config change. Hence this ADR.

## Alternatives considered

- **`roles: Role[]` / a `UserRole` join table** — rejected for v1: adds role-resolution and "current role" UI to a 3-role demo that has no dual-role users yet.
- **Buyer→seller upgrade path** (convert a `buyer` `User` in place) — rejected: sellers are onboarded white-glove by staff, so the conversion has no self-serve trigger, and the collision rule already forces a clean separate account.
