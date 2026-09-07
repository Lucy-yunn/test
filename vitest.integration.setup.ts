import { existsSync } from "node:fs";
import { resolveTestDbEnv } from "./scripts/resolve-test-db-env";

/**
 * Integration tests run against the Neon `test` branch and nothing else.
 * `.env.test.local` supplies `TEST_DATABASE_URL`; `resolveTestDbEnv` throws if it
 * is missing or equal to `DATABASE_URL` — there is no fallback.
 */
const ENV_FILE = ".env.test.local";
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const resolved = resolveTestDbEnv(process.env);
process.env.DATABASE_URL = resolved.DATABASE_URL;
process.env.DIRECT_URL = resolved.DIRECT_URL;
// NODE_ENV is already "test" here (Vitest sets it); resolved.NODE_ENV documents intent.
