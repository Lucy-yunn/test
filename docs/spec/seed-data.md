# Seed catalogue & fixtures — build step 1

> Status: **partially done.** The frozen taxonomy is final. The vehicle catalogue
> is a **placeholder** pending the founder's real pilot-donor list. Demo fixtures
> are written and cover every seller-center surface, but have **not been run
> against a database** (no Neon instance yet).

Build step 1 in [`README.md`](./README.md) §6 must be complete before any funnel /
Browse / search work — the funnel steps, facets and "what's in stock" all read
from this data.

## What's in the repo

| File | Contents | State |
|---|---|---|
| `prisma/seed/taxonomy.ts` | 13 display Groups + "Other", and every selectable leaf `Category` (73 leaves + 1 catch-all), en-GB, immutable kebab-case slugs, synonyms | **Final** — from research [#3](https://github.com/Lucy-yunn/test/issues/3). Only staff add categories later. |
| `prisma/seed/vehicles.ts` | 9 makes → 13 model groups → 29 generations (VW, Audi, BMW, Mercedes, Opel, Renault, Peugeot, Ford, Toyota) | **Placeholder.** Plausible common Bulgarian-dismantler stock; chassis codes / date ranges are best-effort, not verified. |
| `prisma/seed.ts` | Full demo dataset: 2 staff, 3 buyers, 4 sellers (1 with a login), 8 donor vehicles, 19 listings across all 6 statuses, favourites, 5 orders across the lifecycle, 1 pending `CancellationRequest`, 3 threads (2 with unread messages), notification rows | **Written, not executed.** |
| `prisma/seed/fixtures.test.ts` | Vitest checks on the static fixtures (unique slugs, valid references, slug format) | Passing. |

Every demo account's password is `demo-password-123` (printed by the seed run).

## What still needs the founder

1. **The real vehicle catalogue.** Ask the Bulgarian contacts for the actual
   cars their yards are cutting. For each: make, the model designation(s) that
   share a generation (e.g. `A4, S4`), the generation/platform with its chassis
   codes and production years. Replace `GENERATIONS` in `prisma/seed/vehicles.ts`.
   Target ~10–20 makes / ~40–70 model groups / ~80–140 generations
   ([#4](https://github.com/Lucy-yunn/test/issues/4)). No open-dataset import —
   hand-built only.
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
