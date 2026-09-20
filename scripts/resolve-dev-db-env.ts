import { assertLocalDatabaseUrl } from "./local-db-guard";

/**
 * Resolves the environment for the commands that change the DEVELOPMENT database:
 * `db:migrate`, `db:deploy` and `db:seed` (which wipes every table first).
 * Used by `scripts/with-dev-db.ts`.
 *
 * Contract:
 *  - Reads ONLY `DATABASE_URL` / `DIRECT_URL`, never `TEST_DATABASE_URL`.
 *  - Both must be localhost / 127.0.0.1 and the database `ivo_dev`, through
 *    `assertLocalDatabaseUrl`. There is no override for a remote database.
 *  - A missing `DATABASE_URL` throws. `DIRECT_URL` defaults to it, because a local
 *    PostgreSQL has no connection pooler to tell apart.
 */
export interface ResolvedDevDbEnv {
  DATABASE_URL: string;
  DIRECT_URL: string;
}

type EnvLike = Record<string, string | undefined>;

export function resolveDevDbEnv(env: EnvLike): ResolvedDevDbEnv {
  const databaseUrl = env.DATABASE_URL?.trim();
  assertLocalDatabaseUrl("DATABASE_URL", databaseUrl, "dev");

  const directUrl = env.DIRECT_URL?.trim();
  if (directUrl) assertLocalDatabaseUrl("DIRECT_URL", directUrl, "dev");

  return { DATABASE_URL: databaseUrl as string, DIRECT_URL: directUrl || (databaseUrl as string) };
}
