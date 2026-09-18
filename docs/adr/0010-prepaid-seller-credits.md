# ADR-0010 — Monetisation is prepaid seller credits, topped up by staff

- **Status:** accepted
- **Date:** 2026-09-19
- **Source:** founders' v1 scope revision · full rules in [`docs/seller-credits.md`](../seller-credits.md)
- **Reverses:** "payment / monetisation deferred" in [`order-model.md`](../order-model.md), "no finance / subscription modules" in [`seller-center.md`](../seller-center.md) and [`spec/admin-tool.md`](../spec/admin-tool.md)

## Context

Buyers pay the seller cash on delivery, so the platform sits outside the money flow between buyer and seller. It still needs a revenue model. A commission is unenforceable when the sale happens off-platform.

## Decision

Sellers buy **credit bundles** in advance (bigger bundle, cheaper per credit). **Publishing a Listing costs one credit.** Money flows **seller → platform only**; there is no split and no settlement.

- In v1 the top-up is **manual**: a seller pays the founders directly and **staff record it** in the admin tool. No payment provider is integrated.
- Credits live in an **append-only ledger**; the balance is its sum.
- At zero credits, publishing is blocked.
- Credits are **never refunded** when a Listing is cancelled, archived, or sold. A reservation released by an order cancelling does not cost a new credit.

## Consequences

**Positive**
- Revenue does not depend on observing sales.
- No payment provider, PCI scope, or invoicing in v1.
- The ledger is a complete audit trail for disputes.

**Negative / trade-offs**
- Sellers pay before they know a part will sell, which may discourage listing low-value parts.
- Manual top-up is a staff chore and does not scale; a self-serve provider is a later layer that adds ledger entries, not a schema change.
- Invoicing and VAT treatment of the bundle sales are unspecified and need a real answer before launch.

## Alternatives considered

- **Commission per sale** — rejected: the platform cannot see off-platform cash sales.
- **Monthly subscription** — rejected for v1: needs recurring billing and a provider.
- **Charge per 30 days a Listing is active** — rejected: needs a scheduler and auto-expiry for little gain at pilot scale.
- **Charge on sale** — rejected: unverifiable, same reason as commission.
