/**
 * Runs a command against the LOCAL `ivo_test` database, and nothing else.
 *
 *   tsx scripts/with-test-db.ts prisma migrate deploy
 *   tsx scripts/with-test-db.ts prisma db seed
 *
 * Loads `.env.test.local` (if present), then applies `resolveTestDbEnv`, which throws
 * unless `TEST_DATABASE_URL` is set, differs from `DATABASE_URL`, and is localhost /
 * 127.0.0.1 with the database `ivo_test`. `runGuarded` then asks the live server which
 * database it is before the command runs. There is no override for a remote database.
 * Never reads a fallback database URL.
 */
import { loadEnvFileOverriding } from "./load-env-file";
import { resolveTestDbEnv } from "./resolve-test-db-env";
import { runGuarded } from "./guarded-run";

// The file must win over anything already in the environment, including values Prisma copies in from .env.
loadEnvFileOverriding(".env.test.local");

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: tsx scripts/with-test-db.ts <command> [args...]");
  process.exit(2);
}

let resolved;
try {
  resolved = resolveTestDbEnv(process.env);
} catch (err) {
  console.error(`\n✖ ${(err as Error).message}\n`);
  process.exit(1);
}

void runGuarded({ role: "test", env: resolved, command: cmd, args }).then((code) => process.exit(code));
