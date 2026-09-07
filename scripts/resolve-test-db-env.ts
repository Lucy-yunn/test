/**
 * Resolves the environment for an integration-test run against the Neon `test`
 * branch. Used by `scripts/with-test-db.ts` (CLI) and `vitest.integration.setup.ts`.
 *
 * Contract (see docs/spec/seed-data.md and AGENTS.md §Test-driven development):
 *  - Reads ONLY `TEST_DATABASE_URL` / `TEST_DIRECT_URL`.
 *  - Never falls back to `DATABASE_URL` — a missing `TEST_DATABASE_URL` throws.
 *  - Refuses if `TEST_DATABASE_URL` is the same string as `DATABASE_URL`
 *    (guards against pointing tests at the dev/prod database).
 */
export interface ResolvedTestDbEnv {
  DATABASE_URL: string;
  DIRECT_URL: string;
  NODE_ENV: "test";
}

type EnvLike = Record<string, string | undefined>;

export function resolveTestDbEnv(env: EnvLike): ResolvedTestDbEnv {
  const testUrl = env.TEST_DATABASE_URL?.trim();

  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Integration tests require the Neon `test` " +
        "branch (see .env.test.example). It never falls back to DATABASE_URL.",
    );
  }

  if (env.DATABASE_URL && env.DATABASE_URL.trim() === testUrl) {
    throw new Error(
      "TEST_DATABASE_URL equals DATABASE_URL — refusing to run integration tests " +
        "against the development or production database.",
    );
  }

  return {
    DATABASE_URL: testUrl,
    DIRECT_URL: env.TEST_DIRECT_URL?.trim() || testUrl,
    NODE_ENV: "test",
  };
}
