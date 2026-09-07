# Seed catalogue & fixtures — build step 1

> Status: **done.** Frozen taxonomy is final. The vehicle catalogue is the
> founder's real Bulgarian used-parts catalogue v1 (14 makes / 50 model groups /
> 138 generations) — 12 open questions in the confirmation queue, imported as-is
> for v1. The demo dataset has been run against the Neon `development` branch
> (idempotent).

Build step 1 in [`README.md`](./README.md) §6 must be complete before any funnel /
Browse / search work — the funnel steps, facets and "what's in stock" all read
from this data.

## What's in the repo

| File | Contents | State |
|---|---|---|
| `prisma/seed/taxonomy.ts` | 13 display Groups + "Other", and every selectable leaf `Category` (73 leaves + 1 catch-all), en-GB, immutable kebab-case slugs, synonyms | **Final** — from research [#3](https://github.com/Lucy-yunn/test/issues/3). Only staff add categories later. |
| `prisma/seed/data/vehicle-catalogue.csv` | Founder's Bulgarian used-parts vehicle catalogue v1 — 138 generation rows with market evidence + sources + priority. **The source of truth.** | Supplied 2026-09-07. |
| `prisma/seed/data/vehicle-catalogue-confirmation-queue.csv` | 12 open questions for the Bulgarian dismantlers (facelift-as-generation, year basis, make coverage, LHD/RHD, …). 15/138 rows flagged `local_confirmation_required`. | Not blocking — imported as-is for v1. |
| `prisma/seed/vehicles.ts` | **GENERATED** from the CSV by `npm run build:vehicle-fixture` — 14 makes / 50 model groups / 138 generations. Do not hand-edit. | Final for v1. |
| `prisma/seed.ts` + `prisma/seed/seed.ts` | Thin `prisma db seed` entrypoint + the node-safe seed logic (`seedDatabase(db)`). Full demo dataset: 2 staff, 3 buyers, 4 sellers (1 with a login), 8 donor vehicles, 19 listings across all 6 statuses, 5 favourites, 5 orders across the lifecycle, 1 pending `CancellationRequest`, 3 threads (2 with unread messages), 15 notifications | **Run — idempotent.** Seed logic is decoupled from `lib/auth.ts` (password hashing via `better-auth/crypto`) so it runs under plain Node. |
| `prisma/seed/fixtures.test.ts` | Vitest checks on the static fixtures (unique slugs, valid references, slug format) | Passing. |
| `prisma/seed/seed.node-safety.test.ts` | Regression: the seed's import graph never reaches `server-only` / a Next-only module | Passing. |
| `prisma/migrations/` | Initial migration from `schema.prisma`, applied to the `development` and `test` branches | Committed. |

Every demo account's password is `demo-password-123` (printed by the seed run).

## What still needs the founder

1. ~~The real vehicle catalogue~~ — **done** (`vehicle-catalogue.csv`, 2026-09-07).
   Still to resolve with the dismantlers: the 12 items in
   `vehicle-catalogue-confirmation-queue.csv` (mostly facelift boundaries, year
   basis, and which additional makes — Dacia, SEAT, Hyundai, Kia, Volvo, Mazda —
   have enough partner inventory to add). Update the CSV, re-run
   `npm run build:vehicle-fixture`, re-run `db:seed`.
2. **Neon branches wired in.** Create the project (EU region) with `development`,
   `test` and `production` branches, then run `bash scripts/setup-neon.sh` — it
   pastes the development branch into `.env.local`, the test branch into
   `.env.test.local` (`TEST_DATABASE_URL`, never falls back to `DATABASE_URL`),
   creates the first migration, and seeds the development branch. Production is
   configured later, in Vercel — never locally.
3. **A Vercel Blob store** (for real listing photos later — build step 4). The
   seed uses `placehold.co` placeholder URLs; add the real hostname to
   `next.config.ts` `images.remotePatterns` and drop `placehold.co`.
4. **Confirm the category leaf count.** Research #3's prose said "~61"; the
   enumerated list it gives is 73 + the catch-all. The enumerated list was taken
   as authoritative. Flag if any leaf should be dropped or merged for v1.

## Demo coverage (seller-center §11 checklist)

The login-enabled seller **Sofia Auto Dismantlers** (`yard.sofia@example.com`) has:

- listings in **all six** statuses, spanning multiple `Group`s;
- 5 favourites pointing at its listings (incl. one now `sold`/`reserved`);
- orders in `placed`, `confirmed`, `shipped`, `delivered`, `cancelled`;
- one **pending** `CancellationRequest` on the `confirmed` order;
- 3 message threads, 2 with unread buyer messages;
- `Notification` rows for each order event (buyer + seller-login).
