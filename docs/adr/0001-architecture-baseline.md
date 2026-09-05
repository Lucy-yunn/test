# 0001 — Architecture baseline (v1 tech stack)

- **Status:** proposed — pending founder review
- **Date:** 2026-09-05
- **Ticket:** [#6 Tech stack & architecture baseline](https://github.com/Lucy-yunn/test/issues/6) (Wayfinder research)
- **Map:** [#1 Used auto parts marketplace MVP spec](https://github.com/Lucy-yunn/test/issues/1)
- **Research:** [`docs/research/tech-stack-baseline.md`](../research/tech-stack-baseline.md)

## Context

We are building a Part-centric used automotive parts marketplace MVP (Bulgaria first, EU later).
v1 is a **functional demo with seed data and no real payments**. It is built by a solo founder
working with Claude Code, reviewed (and sometimes edited) by a second developer. The map's
standing constraints: optimise for development speed and low ops burden, but do not pick anything
that blocks the known roadmap (multi-country, more sellers, real payments). English UI **with a
language toggle from day one** (Bulgarian later); EUR only.

The repo is a **modified Next.js `16.3.4`** scaffold. `AGENTS.md` warns that APIs and conventions
differ from model training data; the version-matched docs bundled at `node_modules/next/dist/docs/`
are the source of truth. The research doc catalogues the breaking changes; the material ones for
this decision:

- Request APIs (`cookies`, `headers`, `params`, `searchParams`) are **async-only**.
- `middleware` is renamed to **`proxy`** and is **Node-runtime only** (no edge).
- **Turbopack** is the default bundler; a custom `webpack` config breaks `next build`.
- `next lint` is **removed**; ESLint runs via its own CLI (flat config).
- `next/image` defaults changed: `images.domains` deprecated → `remotePatterns`;
  `qualities` default `[75]`; `minimumCacheTTL` 4h.
- PPR / `dynamicIO` / `useCache` flags removed; PPR-style behaviour is now the opt-in
  `cacheComponents` model and is **not** a rename-only change.
- Node **20.9+**, React **19.2**, `serverRuntimeConfig`/`publicRuntimeConfig` removed.

## Decision

### Next.js usage pattern
- **App Router**, all routes under **`app/[locale]/…`**; `locale` is a root param read via
  `next/root-params`. `generateStaticParams` returns `['en']` now.
- **Server Components by default** for all data reads, fetched through a **Data Access Layer**
  (`verifySession()` → memoised `cache()` → return DTOs). Auth checks live in the DAL and in
  each Server Action — **not** in layouts.
- **Server Actions** for every mutation (registration, auth, favorites, messaging, order stub,
  all staff admin actions); each re-validates auth + role internally. `useActionState` for
  pending/errors; `revalidatePath` / `redirect` after writes.
- **Route Handlers** (`app/api/**`) only for a health check now; reserved for future webhooks /
  external API.
- **Rendering:** request-time dynamic rendering for authed / DB-backed pages; `<Suspense>` +
  `loading.tsx` for streaming; static only for marketing/legal pages.
  **`cacheComponents` and `reactCompiler` stay off for v1.**
- **`proxy.ts`** (Node runtime): locale resolution/redirect + optimistic cookie-only auth
  redirects.
- `next.config.ts` stays minimal — no `webpack` fn; near-term additions are
  `images.remotePatterns` and i18n wiring.

### Database + ORM
- **PostgreSQL** on a managed host, accessed via **Prisma** (`schema.prisma`, `prisma migrate`,
  `prisma db seed`).
- Rationale: the domain (`Category→Part→Listing`, `Vehicle`, many-to-many `Fitment`, 1:1
  `Provenance` on Listing, `Seller`/`Location`, single-item `Order` state machine,
  `MessageThread`/`Message`, `Favorite`) is relational; Postgres adds `jsonb`, `enum`, and
  full-text search headroom for the roadmap; Prisma maximises iteration speed with Claude Code.
- Serverless deployments must use **pooled connections** (Neon pooler / Prisma Accelerate).
- The concrete schema is **out of scope here** — owned by #2, #3, #4, #5, #8, #10, #11.

### Auth (roles: buyer / seller / staff-admin)
- **Auth.js (NextAuth v5)** — Credentials provider (email + password, hashed with argon2/bcrypt),
  Prisma adapter, JWT session in an HttpOnly/Secure/SameSite cookie, `auth()` in the DAL.
- **`role` enum on `User`** (`BUYER | SELLER | STAFF`); buyers self-register; seller and staff
  accounts are created by a staff-only admin action (set-password link).
- Google / Facebook buttons **rendered but disabled** in v1.
- Full permission matrix + provisioning flow are **#12's** decision.

### Image / photo storage
- **S3-compatible object storage**, referenced by object key/URL per photo, rendered via
  `next/image` with an `images.remotePatterns` allow-list and a thin `lib/storage.ts` wrapper.
- Provider tracks the DB host: **Supabase Storage** if Postgres = Supabase; otherwise
  **UploadThing** (fastest for Next) or **Cloudflare R2** (cheapest at scale).
- No listing photos in `public/` or the repo.

### i18n
- **next-intl** with the `app/[locale]` segment: server-side message catalogs, ICU messages,
  built-in EUR/number/date formatting, ready-made locale switcher.
- All UI copy authored as message keys from the first screen. Adding `bg` later = one messages
  file + one locales-array entry.

### Hosting
- **Vercel** for v1 (verified adapter, zero-config, per-branch preview deploys for review),
  with **managed Postgres that has connection pooling (Neon)**.
- Keep the app portable: standard Node semantics, `output: 'standalone'` builds, no
  Vercel-only APIs, so a later move to a plain Node host is cheap.

### Supporting choices
pnpm · TypeScript `strict` + `next typegen` in CI · Tailwind CSS v4 (already scaffolded) · Zod
for validation · ESLint flat config via CLI · Vitest + Playwright (light) · Node 20.9+ · env
vars only for config.

## Open decisions for founder review

| # | Decision | Recommended | Alternative | Trade-off |
|---|----------|-------------|-------------|-----------|
| 1 | ORM | **Prisma** | Drizzle | Prisma = most Claude-Code examples, easy migrations; Drizzle = lighter runtime, faster cold starts, SQL-first |
| 2 | Auth library | **Auth.js v5** | Better Auth | Auth.js = most examples; Better Auth = cleaner email/password + role/provisioning fit, fewer examples |
| 3 | Hosting + DB host (also picks photo store) | **Vercel + Neon** (+ UploadThing/R2) | Railway/Render/Fly + bundled Postgres (+ Supabase Storage) | Vercel = lowest ops, but serverless needs DB pooling; Node host = simpler runtime model, more setup |
| 4 | i18n library | **next-intl** | zero-dep dictionary pattern / next-international | next-intl = batteries included; dictionary = zero deps, more boilerplate |

## Consequences

**Positive**
- Single language + runtime (TypeScript / Node) end to end; every layer has first-class
  Next.js 16 support and heavy Claude-Code training coverage.
- Server Components + Server Actions remove the need for a separate API layer for v1.
- Relational Postgres models the `Part`/`Listing`/`Fitment`/`Provenance` separation directly and
  leaves search / multi-country / payments headroom.
- Portable by construction: ORM, auth lib, photo store and host are each a contained swap.

**Negative / risks**
- Modified Next.js 16: assistant-generated code from memory will be wrong on async request APIs,
  `proxy`, image config and caching. Mitigation: always read `node_modules/next/dist/docs/`;
  the research doc's §1 is the checklist.
- Serverless + Prisma needs connection pooling configured from the start (or choose a Node host).
- next-intl and the auth library are external deps whose own docs must be read (they are not in
  the bundled Next docs).
- `cacheComponents` deliberately deferred — revisit once the read model and traffic shape are
  known.

## Notes

- No existing ADR to contradict (this is `0001`).
- No `CONTEXT.md` yet; domain vocabulary currently lives in the map's Q1–Q29 record. Domain
  terms used here (`Part`, `Listing`, `Fitment`, `Provenance`, `Seller`, `Location`, `Order`)
  follow that record.
- This ADR fixes engines only. It must not pre-empt #2 (domain model), #8 (listing), #10
  (orders), #11 (messaging), #12 (auth/roles).
