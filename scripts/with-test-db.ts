/**
 * Runs a command with the environment pointed at the Neon `test` branch.
 *
 *   tsx scripts/with-test-db.ts prisma migrate deploy
 *   tsx scripts/with-test-db.ts prisma db seed
 *
 * Loads `.env.test.local` (if present), then applies `resolveTestDbEnv` — which
 * throws unless `TEST_DATABASE_URL` is set and distinct from `DATABASE_URL`.
 * Never reads a fallback database URL.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveTestDbEnv } from "./resolve-test-db-env";

const ENV_FILE = ".env.test.local";
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

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

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ...resolved },
});

process.exit(result.status ?? 1);
