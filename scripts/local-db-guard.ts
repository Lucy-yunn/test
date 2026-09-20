/**
 * The local-database safety guard. Node-safe: no Next imports, no database driver.
 *
 * Every command that can change or wipe data in this workflow (integration tests,
 * migrations, seeds) must pass through here first. It allows exactly two databases,
 * both on this machine:
 *
 *   dev  -> ivo_dev   (local development)
 *   test -> ivo_test  (automated tests)
 *
 * There is deliberately NO override, flag or environment variable that allows a
 * remote database. Two independent checks:
 *
 *  1. `assertLocalDatabaseUrl` reads the connection string and refuses anything
 *     that is not localhost / 127.0.0.1, the exact database name, and no query
 *     parameter that could redirect the connection.
 *  2. `verifyLocalConnection` asks the live server which database it is and what
 *     address it answered from. This catches a name that resolves somewhere
 *     unexpected, which the URL alone cannot show.
 *
 * Error messages never contain the URL, the password or the host, so a failure is
 * safe to paste into a chat or a log.
 */

export type DatabaseRole = "dev" | "test";

export const EXPECTED_DATABASE: Record<DatabaseRole, string> = {
  dev: "ivo_dev",
  test: "ivo_test",
};

const LOCAL_HOSTS: readonly string[] = ["localhost", "127.0.0.1"];
const LOOPBACK_ADDRESSES: readonly string[] = ["127.0.0.1", "::1"];

/**
 * Query parameters that only tune the connection. Anything else, such as `host`,
 * `hostaddr`, `dbname`, `port` or `service`, could point the connection elsewhere.
 */
const ALLOWED_PARAMS: ReadonlySet<string> = new Set([
  "schema",
  "sslmode",
  "connect_timeout",
  "pgbouncer",
  "connection_limit",
  "pool_timeout",
]);

export class UnsafeDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeDatabaseError";
  }
}

export interface DatabaseTarget {
  host: string;
  port: number | null;
  database: string;
}

export function assertLocalDatabaseUrl(
  name: string,
  value: string | undefined,
  role: DatabaseRole,
): DatabaseTarget {
  const expected = EXPECTED_DATABASE[role];
  const refuse = (reason: string): never => {
    throw new UnsafeDatabaseError(
      `${name} ${reason}. Only the local ${expected} database is allowed here; nothing was run.`,
    );
  };

  if (value === undefined || value.trim() === "") return refuse("is not set");
  const raw = value.trim();

  if (raw.toLowerCase().includes("neon.tech")) return refuse("points at a remote database");
  if ((raw.match(/:\/\//g) ?? []).length !== 1) return refuse("is not a single connection string");
  if (!/^postgres(?:ql)?:\/\//i.test(raw)) return refuse("is not a PostgreSQL connection string");
  if (/\s/.test(raw)) return refuse("contains whitespace");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("is not a valid connection string");
  }

  const host = url.hostname.toLowerCase();
  if (!LOCAL_HOSTS.includes(host)) return refuse("must use localhost or 127.0.0.1");

  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_PARAMS.has(key.toLowerCase())) {
      return refuse(`has the parameter "${key}", which is not allowed`);
    }
  }

  const path = url.pathname.replace(/^\//, "");
  let database: string;
  try {
    database = decodeURIComponent(path);
  } catch {
    return refuse("has an unreadable database name");
  }
  if (database !== expected) return refuse(`must name the database ${expected}`);

  return { host, port: url.port ? Number(url.port) : null, database };
}

export interface ConnectionProbe {
  database: string;
  /** The server-side address the connection arrived at; null over a Unix socket. */
  serverAddress: string | null;
}

export function assertConnectedToLocal(probe: ConnectionProbe, role: DatabaseRole): void {
  const expected = EXPECTED_DATABASE[role];
  if (probe.database !== expected) {
    throw new UnsafeDatabaseError(
      `The connected database is not ${expected}. Nothing was run.`,
    );
  }
  if (probe.serverAddress !== null && !LOOPBACK_ADDRESSES.includes(probe.serverAddress)) {
    throw new UnsafeDatabaseError(
      `The connected server is not on this machine. Only the local ${expected} database is allowed; nothing was run.`,
    );
  }
}

/** The one method of the Prisma client the check needs, so tests can stand in for it. */
export interface RawQueryClient {
  $queryRaw: (query: TemplateStringsArray, ...values: never[]) => Promise<unknown>;
}

/**
 * Ask the live connection which database it is. Fails closed: if the question cannot
 * be answered, the operation is refused rather than assumed safe.
 */
export async function verifyLocalConnection(client: RawQueryClient, role: DatabaseRole): Promise<void> {
  let rows: unknown;
  try {
    rows = await client.$queryRaw`SELECT current_database() AS database, host(inet_server_addr()) AS addr`;
  } catch {
    throw new UnsafeDatabaseError("Could not confirm which database is connected. Nothing was run.");
  }

  const row = Array.isArray(rows) ? (rows[0] as { database?: unknown; addr?: unknown } | undefined) : undefined;
  if (!row || typeof row.database !== "string") {
    throw new UnsafeDatabaseError("Could not confirm which database is connected. Nothing was run.");
  }
  assertConnectedToLocal({ database: row.database, serverAddress: typeof row.addr === "string" ? row.addr : null }, role);
}
