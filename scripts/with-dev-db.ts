/**
 * Runs a command against the LOCAL `ivo_dev` database, and nothing else. Used for the
 * commands that change the development database:
 *
 *   tsx scripts/with-dev-db.ts prisma migrate dev
 *   tsx scripts/with-dev-db.ts prisma migrate deploy
 *   tsx scripts/with-dev-db.ts prisma db seed        (wipes every table first)
 *
 * Loads `.env.local` (if present), then applies `resolveDevDbEnv`, which throws unless
 * `DATABASE_URL` (and `DIRECT_URL`, if set) are localhost / 127.0.0.1 with the database
 * `ivo_dev`. `runGuarded` then asks the live server which database it is before the
 * command runs. There is no override for a remote database.
 */
import { loadEnvFileOverriding } from "./load-env-file";
import { resolveDevDbEnv } from "./resolve-dev-db-env";
import { runGuarded } from "./guarded-run";

// .env.local must beat the placeholder that importing Prisma copies in from .env.
loadEnvFileOverriding(".env.local");

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: tsx scripts/with-dev-db.ts <command> [args...]");
  process.exit(2);
}

let resolved;
try {
  resolved = resolveDevDbEnv(process.env);
} catch (err) {
  console.error(`\n✖ ${(err as Error).message}\n`);
  process.exit(1);
}

void runGuarded({ role: "dev", env: resolved, command: cmd, args }).then((code) => process.exit(code));
