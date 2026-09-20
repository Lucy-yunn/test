import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  assertLocalDatabaseUrl,
  verifyLocalConnection,
  UnsafeDatabaseError,
  type DatabaseRole,
  type RawQueryClient,
} from "./local-db-guard";

/**
 * Runs a command against the local database only, and only after the live connection
 * has been checked. Used by `with-dev-db.ts` (migrations, dev seed) and `with-test-db.ts`
 * (test migrations, test seed).
 *
 * Order, and nothing runs unless every step passes:
 *   1. the connection URLs are local and name the right database;
 *   2. the live server confirms it is that database, on this machine;
 *   3. the command runs with those URLs in its environment.
 *
 * The messages it prints never contain the URL or the password.
 */
export interface GuardedRunOptions {
  role: DatabaseRole;
  /** Must contain DATABASE_URL; DIRECT_URL is optional, and NODE_ENV is passed to the command. */
  env: { DATABASE_URL?: string; DIRECT_URL?: string; NODE_ENV?: string };
  command: string;
  args: string[];
}

export interface GuardedClient extends RawQueryClient {
  $disconnect: () => Promise<void>;
}

export interface GuardedRunDeps {
  makeClient: (databaseUrl: string) => GuardedClient;
  spawn: (command: string, args: string[], env: NodeJS.ProcessEnv) => number;
  report: (line: string) => void;
}

const defaultDeps: GuardedRunDeps = {
  makeClient: (databaseUrl) => new PrismaClient({ datasourceUrl: databaseUrl }) as unknown as GuardedClient,
  spawn: (command, args, env) => spawnSync(command, args, { stdio: "inherit", shell: true, env }).status ?? 1,
  report: (line) => console.error(line),
};

export async function runGuarded(options: GuardedRunOptions, deps: GuardedRunDeps = defaultDeps): Promise<number> {
  const { role, env, command, args } = options;

  try {
    assertLocalDatabaseUrl("DATABASE_URL", env.DATABASE_URL, role);
    if (env.DIRECT_URL?.trim()) assertLocalDatabaseUrl("DIRECT_URL", env.DIRECT_URL, role);
  } catch (err) {
    deps.report(`\n✖ ${describe(err)}\n`);
    return 1;
  }

  const client = deps.makeClient(env.DATABASE_URL as string);
  try {
    await verifyLocalConnection(client, role);
  } catch (err) {
    deps.report(`\n✖ ${describe(err)}\n`);
    return 1;
  } finally {
    await client.$disconnect().catch(() => undefined);
  }

  return deps.spawn(command, args, { ...process.env, ...env } as NodeJS.ProcessEnv);
}

function describe(err: unknown): string {
  return err instanceof UnsafeDatabaseError
    ? err.message
    : "The database safety check failed for an unexpected reason. Nothing was run.";
}
