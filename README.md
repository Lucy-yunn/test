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
cp .env.example .env.local          # then fill in real values
npm run db:migrate                  # first Prisma migration (needs a Neon DB)
npm run db:seed                     # demo data — see docs/spec/seed-data.md
npm run dev                         # http://localhost:3000
```

Without a database you can still run `npm run build`, `npm run typecheck`,
`npm run lint` and `npm run test` (a local placeholder `.env` covers Prisma
schema validation; pass `SKIP_ENV_VALIDATION=1` to build without real secrets).

## Scripts

| Script | Does |
|---|---|
| `dev` / `build` / `start` | Next.js (Turbopack) |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint (flat config) |
| `test` / `test:watch` | Vitest |
| `db:migrate` / `db:deploy` | Prisma migrations (dev / prod) |
| `db:seed` | Load demo fixtures |
| `db:studio` | Prisma Studio |

## Layout

```
app/[locale]/         buyer site + /account + /seller + /admin (all locale-prefixed)
app/api/auth/         Better Auth route handler
app/api/health/       health check (the only other v1 route handler)
i18n/                 next-intl routing / navigation / request config
lib/                  db · auth · dal (the authz boundary) · storage · env
messages/             en.json (complete) · bg.json (scaffold)
prisma/schema.prisma  full v1 schema
prisma/seed*          demo catalogue + fixtures
proxy.ts              locale routing + optimistic cookie auth redirect
```

## Build status

Wayfinding is complete; the build has started. Progress against
[`docs/spec/README.md`](docs/spec/README.md) §6:

- [x] **0. Project setup** — stack wired, schema, DAL skeleton, i18n, health check
- [~] **1. Seed catalogue & fixtures** — taxonomy final; vehicle catalogue is a
  placeholder pending the founder's real pilot-donor list; fixtures written, not
  yet run against a DB. See [`docs/spec/seed-data.md`](docs/spec/seed-data.md).
- [ ] 2. Schema & DAL · 3. Auth & accounts · 4. Admin intake · 5. Buyer funnel &
  Browse · 6. Favourites · 7. Checkout & orders · 8. Cancellation · 9. Messaging ·
  10. Seller center · 11. Notifications · 12. Shell & polish
