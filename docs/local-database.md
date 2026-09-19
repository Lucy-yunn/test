# Local database workflow

Development and automated tests run against a **PostgreSQL 18 installed on this machine**, in two separate databases:

| Database | Used by | Reached with |
|---|---|---|
| `ivo_dev` | `npm run dev`, `db:migrate`, `db:deploy`, `db:seed` | `.env.local` |
| `ivo_test` | `npm run test:integration`, `db:migrate:test`, `db:seed:test` | `.env.test.local` |

The Neon databases, including production, are **not part of this workflow** and are never touched by it. Production settings live only in Vercel.

## Why local

A query to the Neon database in Frankfurt took about 0.47 seconds from the developer's machine, so pages took several seconds and a full test run took many minutes. A local database answers in about a millisecond.

## The safety rules

Every command that can change or wipe data goes through `scripts/local-db-guard.ts` first. There is **no override, flag or environment variable** that allows a remote database.

1. **The address is checked.** The host must be exactly `localhost` or `127.0.0.1`, the database name must be exactly `ivo_dev` (development) or `ivo_test` (tests), and no query parameter may redirect the connection (`host`, `hostaddr`, `dbname`, `port`, `service`, and so on). Anything mentioning `neon.tech` is refused.
2. **The live server is asked.** Before the command runs, the server reports its own database name and the address it answered from. The name must match and the address must be a loopback address. This catches a name that resolves somewhere unexpected.
3. **It fails closed.** If the question cannot be answered, the command does not run.
4. **Messages are safe to share.** Errors never contain the URL, the host or the password.

| Command | Guard |
|---|---|
| `npm run test:integration` | `vitest.integration.setup.ts`: URL check, then the live check, before any test file runs |
| `npm run db:migrate:test`, `npm run db:seed:test` | `scripts/with-test-db.ts` |
| `npm run db:migrate`, `npm run db:deploy`, `npm run db:seed` | `scripts/with-dev-db.ts` |
| the seed itself | `seedDatabase` asks the live connection before it wipes any table |

`scripts/package-scripts.test.ts` fails if a script that runs `prisma migrate`, `prisma db seed` or `prisma db push` is added without going through these wrappers.

### What is deliberately not guarded

- `npm run dev` and the running app read `DATABASE_URL` but only query. Pointing them at Neon is possible and harmless to data.
- `npm run db:studio` opens whatever `.env.local` points at. It can edit rows by hand, so look at which database it is showing.
- `npm run db:seed:staff` upserts the staff accounts and is meant to be usable against production later, so it is not restricted to local.
- `npm run db:generate` and `postinstall` (`prisma generate`) never connect.

## Setting it up

Run these yourself, in an interactive terminal (PowerShell or Windows Terminal), from the project folder. Each step tells you what it did and never prints a password.

1. **Install PostgreSQL 18** and create the two databases `ivo_dev` and `ivo_test` (the service listens on `localhost:5432`).
2. **Back up the current settings:** `npx tsx scripts/setup-local-db.ts backup`. This copies `.env.local` to `.env.neon-dev.local` and `.env.test.local` to `.env.neon-test.local`. Both are ignored by git, and an existing backup is never overwritten.
3. **Write the local settings:** `npx tsx scripts/setup-local-db.ts configure`. It asks for the user name and port (defaults `postgres` and `5432`) and for the password at a hidden prompt. It changes only `DATABASE_URL` and `DIRECT_URL` in `.env.local` and `TEST_DATABASE_URL` and `TEST_DIRECT_URL` in `.env.test.local`. Every other line is left as it was.
4. **Check both databases answer:** `npx tsx scripts/setup-local-db.ts check`. It reads only and reports how many tables each database has.
5. **Create the tables:** `npm run db:deploy`, then `npm run db:migrate:test`.
6. **Load the demo data and staff accounts:** `npm run db:seed`, then `npm run db:seed:staff`.
7. **Run the tests:** `npm run test:integration`.

To go back to the Neon settings: `npx tsx scripts/setup-local-db.ts restore --yes`. Migrations, seeds and tests will still refuse a remote database after that, so a restored configuration is only for running the app.

## Things to know

- The local databases start empty. The demo data is rebuilt by the seed, not copied from Neon.
- The same password is used for both databases. It is only for this machine, so choose one you do not use anywhere else.
- Tests create and delete their own tagged rows. `db:seed:test` wipes `ivo_test` completely, which is fine because it is throwaway.
- Production migrations are not run from this machine. When production exists they should run as part of the Vercel deployment, under their own reviewed step.
