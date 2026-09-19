import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { resolveTestDbEnv } from "./scripts/resolve-test-db-env";
import { verifyLocalConnection } from "./scripts/local-db-guard";

/**
 * Integration tests run against the LOCAL `ivo_test` database and nothing else.
 * `.env.test.local` supplies `TEST_DATABASE_URL`; `resolveTestDbEnv` throws if it is
 * missing, equal to `DATABASE_URL`, or not localhost / 127.0.0.1 with the database
 * `ivo_test`. There is no fallback and no override for a remote database.
 *
 * Before any test file runs, the live server is asked which database it is. If the
 * answer is not the local ivo_test, this throws and no test touches the database.
 */
const ENV_FILE = ".env.test.local";
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const resolved = resolveTestDbEnv(process.env);
process.env.DATABASE_URL = resolved.DATABASE_URL;
process.env.DIRECT_URL = resolved.DIRECT_URL;
// NODE_ENV is already "test" here (Vitest sets it); resolved.NODE_ENV documents intent.

const probe = new PrismaClient({ datasourceUrl: resolved.DATABASE_URL });
try {
  await verifyLocalConnection(probe, "test");
} finally {
  await probe.$disconnect();
}
