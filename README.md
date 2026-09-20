# IVO — used auto parts marketplace (v1)

A Part-centric marketplace for used automotive parts. Bulgaria first. **v1 is a
functional demo with seed data — no real payments.**

- **Spec:** [`docs/spec/README.md`](docs/spec/README.md) is the build front door
  (dependency-ordered build sequence in §6). Domain model:
  [`docs/domain-model.md`](docs/domain-model.md). Decisions:
  [`docs/adr/`](docs/adr/). Glossary: [`CONTEXT.md`](CONTEXT.md).
- **This is not stock Next.js** — see [`AGENTS.md`](AGENTS.md). Version-matched
  docs are at `node_modules/next/dist/docs/`.

## Stack (ADR-0001)

Next.js 16 App Router · React 19 · Tailwind v4 · PostgreSQL (Neon) · Prisma ·
Better Auth (+ `admin` plugin) · next-intl (`app/[locale]`, EN complete, `bg`
scaffolded) · Vercel Blob (behind `lib/storage.ts`) · Zod · Vitest · Vercel.

## Getting started

```bash
npm install
                                    # then set up the local PostgreSQL databases
                                    # (ivo_dev, ivo_test): docs/local-database.md
npm run dev                         # http://localhost:3000
```

Development and tests run on a **local PostgreSQL**, not Neon; see
[`docs/local-database.md`](docs/local-database.md). `.env.local` → the local
`ivo_dev` database. `.env.test.local` → the local `ivo_test` database
(`TEST_DATABASE_URL`); integration tests use this and nothing else — it never
falls back to `DATABASE_URL`. Templates: `.env.example`, `.env.test.example`.
`scripts/setup-neon.sh` is obsolete for day-to-day work but kept for moving
development back onto Neon. Production is
never configured locally.

Without a database you can still run `npm run build`, `npm run typecheck`,
`npm run lint` and `npm run test` (a local placeholder `.env` covers Prisma
schema validation; pass `SKIP_ENV_VALIDATION=1` to build without real secrets).
`npm run test:integration` needs the test branch.

## Scripts

| Script | Does |
|---|---|
| `dev` / `build` / `start` | Next.js (Turbopack) |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint (flat config) |
| `test` / `test:watch` | Vitest — unit only, no DB |
| `test:integration` | Vitest — `*.integration.test.ts` against the Neon test branch |
| `db:migrate` / `db:deploy` | Prisma migrations on the **development** branch (reads `.env.local`) |
| `db:migrate:test` / `db:seed:test` | same, on the **test** branch (reads `.env.test.local`) |
| `db:seed` | Load demo fixtures into the development branch |
| `db:seed:staff` | Create/update the founder staff accounts (`STAFF_<n>_*` env vars) |
| `db:studio` | Prisma Studio |

## Layout

```
app/[locale]/         buyer site + /account + /seller + /admin (all locale-prefixed)
app/api/auth/         Better Auth route handler
app/api/health/       health check (the only other v1 route handler)
i18n/                 next-intl routing / navigation / request config
lib/                  db · auth · storage · env · connection-string
lib/dal/              authz boundary + behavioural invariants (session.ts is server-only)
messages/             en.json (complete) · bg.json (scaffold)
prisma/schema.prisma  full v1 schema
prisma/seed*          demo catalogue + fixtures
scripts/setup-neon.sh obsolete Neon wiring wizard (kept for moving back to Neon)
scripts/setup-local-db.ts local PostgreSQL setup (see docs/local-database.md)
scripts/*-test-db*    integration-test DB resolver (test branch only, no fallback)
proxy.ts              locale routing + optimistic cookie auth redirect
```

## Build status

Wayfinding is complete; the build has started. Progress against
[`docs/spec/README.md`](docs/spec/README.md) §6:

- [x] **0. Project setup** — stack wired, schema, DAL skeleton, i18n, health check
- [~] **1. Seed catalogue & fixtures** — taxonomy final; demo dataset run against
  the Neon dev branch (idempotent); vehicle catalogue is still a placeholder
  pending the founder's real pilot-donor list. See
  [`docs/spec/seed-data.md`](docs/spec/seed-data.md).
- [x] **2. Schema & DAL** — `lib/dal/`: session guards (`verifySession` /
  `requireBuyer|Seller|Staff`, seller needs a linked login), pure role +
  ownership decisions, typed errors, order/listing/part status machines,
  `normalizePartNumber`, and the DB-backed invariants (`sellerId ==
  donorVehicle.sellerId`, category-delete, intake de-dup). Node-safe parts are
  unit-tested; DB parts are `*.integration.test.ts`.
- [x] **3. Auth & accounts** — buyer `/register` (atomic `User` + `Buyer` in one
  transaction), `/login` → role redirect, logout, `/account/settings`
  (name / password / delivery address; email + delete disabled). Staff accounts:
  `npm run db:seed:staff` (idempotent, `STAFF_<n>_*` env vars). Services in
  `lib/services/accounts.ts`, TDD'd against the test branch.
- [x] **4. Admin tool — intake path** — `/admin` shell (`requireStaff` per page,
  not layout). Sellers · Vehicle catalogue · Buyers (4a); Parts & PartNumbers
  (4b); DonorVehicle editor · Listing editor · `ListingDefect`s · publish
  checklist (the only `draft → published` gate) · staff status transitions (4c);
  photo upload — `sharp` downscale on ingest, Vercel Blob behind an injected
  store, soft cap 15, reorder/primary (4d). Follow-up: Part hard-merge (needs an
  `AuditLog` table).
- [x] **5. Buyer funnel & Browse** — data layer (5a); homepage funnel bar +
  `/browse` (faceted rail, sort, pagination, chips, empty states) + buyer-site
  shell (`(shop)` route group, purple header + commerce footer) (5b);
  `/listing/[code]` — photo gallery, part + part numbers, donor vehicle (masked
  VIN), defects, Buy/Save/Message states per the permission matrix (wired in
  6/7/9), and **"More parts from the same car"** (donor siblings, badge-free,
  8 + See-all, hidden when none) (5c).
- [x] **6. Favourites** (Saved Parts) · **7. Retrofit** for the 2026-09 scope change ·
  **8. Seller profile, donor-vehicle page and Saved Sellers**
- [x] **9. Credits** — bundles, the ledger, one credit per publish, the block at zero, the
  admin Credits panel ([`docs/seller-credits.md`](docs/seller-credits.md))
- [x] **10. Orders & cancellation** — reserve, the seller-operated lifecycle, instant and requested
  cancellation, the 7-day cron sweep ([`docs/order-model.md`](docs/order-model.md))
- [x] **11. Messaging** — threads, unread state, staff moderation
  ([`docs/messaging-model.md`](docs/messaging-model.md))
- [x] **12. Reviews** ([`docs/reviews.md`](docs/reviews.md)) · **13. Seller center**
  ([`docs/seller-center.md`](docs/seller-center.md)) · **14. Notifications**
  ([`docs/notifications.md`](docs/notifications.md))
- [x] **15. Shell & polish** — language select, commerce footer and policy pages (legal copy is
  **placeholder** and needs a real review before launch), the styled 404, a real 403 page, and a
  buyer account home

Still to do before any launch: the real legal copy, the real vehicle catalogue, the real credit
bundle prices, and a working Vercel deployment.
