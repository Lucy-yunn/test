import { assertLocalDatabaseUrl, EXPECTED_DATABASE, type DatabaseRole } from "./local-db-guard";

/**
 * Builds the connection strings for the local PostgreSQL databases. Used by the local
 * setup tool. Pure: it returns text and touches no file and no network. The result
 * always passes `assertLocalDatabaseUrl`, and an odd character in the user name or
 * password cannot change the host or the database.
 */

const HOST = "127.0.0.1";

export interface LocalCredentials {
  user: string;
  password: string;
  port: number;
}

export function buildLocalDatabaseUrl(role: DatabaseRole, credentials: LocalCredentials): string {
  const { user, password, port } = credentials;
  if (user.trim() === "") throw new Error("The database user name is empty.");
  if (password === "") throw new Error("The database password is empty.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The port is not a valid port number.");

  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${HOST}:${port}/${EXPECTED_DATABASE[role]}`;
  assertLocalDatabaseUrl("The local connection string", url, role);
  return url;
}

export interface LocalEnvPlan {
  /** Variables for `.env.local`: the development database. */
  envLocal: { DATABASE_URL: string; DIRECT_URL: string };
  /** Variables for `.env.test.local`: the test database. */
  envTestLocal: { TEST_DATABASE_URL: string; TEST_DIRECT_URL: string };
}

export function planLocalEnv(credentials: LocalCredentials): LocalEnvPlan {
  const dev = buildLocalDatabaseUrl("dev", credentials);
  const test = buildLocalDatabaseUrl("test", credentials);
  return {
    // A local PostgreSQL has no connection pooler, so both are the same address.
    envLocal: { DATABASE_URL: dev, DIRECT_URL: dev },
    // TEST_DIRECT_URL is set too, so an old Neon value left in the file cannot survive.
    envTestLocal: { TEST_DATABASE_URL: test, TEST_DIRECT_URL: test },
  };
}
