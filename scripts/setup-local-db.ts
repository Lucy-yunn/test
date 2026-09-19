/**
 * Guided setup for the LOCAL PostgreSQL databases (ivo_dev and ivo_test).
 * Run it yourself, in a normal interactive terminal (PowerShell or Windows Terminal):
 *
 *   npx tsx scripts/setup-local-db.ts backup       1. keep a copy of the current Neon settings
 *   npx tsx scripts/setup-local-db.ts configure    2. point the app and the tests at the local databases
 *   npx tsx scripts/setup-local-db.ts check        3. confirm both local databases answer, read-only
 *   npx tsx scripts/setup-local-db.ts restore --yes   go back to the backed-up Neon settings
 *
 * Safety:
 *  - It never prints a password or a connection string.
 *  - The password is typed at a hidden prompt and only ever written into your own
 *    .env.local and .env.test.local, both of which git ignores.
 *  - `configure` refuses to run until the backup exists, and only changes DATABASE_URL and
 *    DIRECT_URL (in .env.local) and TEST_DATABASE_URL (in .env.test.local). Every other
 *    line of both files is left exactly as it is.
 *  - `check` only reads. It runs no migration and no seed.
 *  - Nothing here ever connects to a remote database: every address is checked by
 *    scripts/local-db-guard.ts first.
 */
import { constants, copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { setEnvValues } from "./env-file";
import { planLocalEnv } from "./local-db-config";
import { verifyLocalConnection, UnsafeDatabaseError } from "./local-db-guard";
import { resolveDevDbEnv } from "./resolve-dev-db-env";
import { resolveTestDbEnv } from "./resolve-test-db-env";

/** [file in use, where its backup lives]. Both backup names are ignored by git (.env*). */
const FILES: [string, string][] = [
  [".env.local", ".env.neon-dev.local"],
  [".env.test.local", ".env.neon-test.local"],
];

const say = (line = "") => console.log(line);
const fail = (line: string): never => {
  console.error(`\n✖ ${line}\n`);
  return process.exit(1);
};

function isGitIgnored(path: string): boolean {
  return spawnSync("git", ["check-ignore", "-q", path], { stdio: "ignore" }).status === 0;
}

function backup(): void {
  for (const [source, copy] of FILES) {
    if (!existsSync(source)) {
      say(`- ${source}: not found, nothing to back up.`);
      continue;
    }
    if (existsSync(copy)) {
      say(`- ${copy}: already exists, kept as it is (never overwritten).`);
      continue;
    }
    if (!isGitIgnored(copy)) fail(`${copy} would not be ignored by git. Nothing was copied.`);
    copyFileSync(source, copy, constants.COPYFILE_EXCL);
    say(`- ${source} -> ${copy}: backed up.`);
  }
  say("\nDone. The backups are ignored by git and are never read by the app or the tests.");
}

/** Key codes in raw terminal mode: Ctrl+C, and the Backspace key (which sends DEL). */
const CTRL_C = String.fromCharCode(3);
const BACKSPACE = String.fromCharCode(127);

async function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) fail("Run this in an interactive terminal such as PowerShell, so the password can be typed hidden.");
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === CTRL_C) {
          stdin.setRawMode(false);
          process.stdout.write("\nCancelled. Nothing was changed.\n");
          process.exit(130);
        }
        if (ch === BACKSPACE || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

function writeAtomically(path: string, text: string): void {
  const temp = `${path}.tmp`;
  writeFileSync(temp, text, "utf8");
  renameSync(temp, path);
}

async function configure(): Promise<void> {
  for (const [source, copy] of FILES) {
    if (existsSync(source) && !existsSync(copy)) {
      fail(`${source} exists but has no backup yet. Run "backup" first. Nothing was changed.`);
    }
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const user = (await rl.question("PostgreSQL user name [postgres]: ")).trim() || "postgres";
  const portText = (await rl.question("PostgreSQL port [5432]: ")).trim() || "5432";
  rl.close();
  const port = Number(portText);
  const password = await readHidden("PostgreSQL password (hidden, type it then press Enter): ");

  let plan;
  try {
    plan = planLocalEnv({ user, password, port });
  } catch {
    return fail("That user name, password or port cannot be used. Nothing was changed.");
  }

  const targets: [string, Record<string, string>][] = [
    [".env.local", plan.envLocal],
    [".env.test.local", plan.envTestLocal],
  ];
  for (const [file, updates] of targets) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : "";
    writeAtomically(file, setEnvValues(current, updates));
    say(`- ${file}: updated ${Object.keys(updates).join(", ")}. Every other line was left as it was.`);
  }
  say('\nNext: run "npx tsx scripts/setup-local-db.ts check" to confirm both databases answer.');
}

async function probe(label: string, url: string, role: "dev" | "test"): Promise<void> {
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    await verifyLocalConnection(client, role);
    const rows = await client.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`;
    const tables = Number(rows[0]?.n ?? 0);
    say(`- ${label}: connected, local. ${tables} table(s) in it.${tables === 0 ? " (empty: the migrations still need to be applied)" : ""}`);
  } catch (err) {
    say(`- ${label}: FAILED. ${err instanceof UnsafeDatabaseError ? err.message : "Could not connect. Is the PostgreSQL service running, and is the password right?"}`);
    process.exitCode = 1;
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

async function check(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  if (existsSync(".env.test.local")) process.loadEnvFile(".env.test.local");

  let dev;
  let test;
  try {
    dev = resolveDevDbEnv(process.env);
    test = resolveTestDbEnv({ ...process.env, DATABASE_URL: undefined });
  } catch (err) {
    return fail(`${(err as Error).message}\nRun "configure" first.`);
  }
  await probe("ivo_dev ", dev.DATABASE_URL, "dev");
  await probe("ivo_test", test.DATABASE_URL, "test");
}

async function restore(flags: string[]): Promise<void> {
  if (!flags.includes("--yes")) {
    fail('This replaces your current .env.local and .env.test.local with the backups. Run it again with "--yes" to confirm.');
  }
  for (const [source, copy] of FILES) {
    if (!existsSync(copy)) {
      say(`- ${copy}: no backup, ${source} left as it is.`);
      continue;
    }
    copyFileSync(copy, source);
    say(`- ${source}: restored from ${copy}.`);
  }
}

const [command, ...flags] = process.argv.slice(2);
const commands: Record<string, () => void | Promise<void>> = {
  backup,
  configure,
  check,
  restore: () => restore(flags),
};

if (!command || !commands[command]) {
  console.error("usage: npx tsx scripts/setup-local-db.ts <backup | configure | check | restore --yes>");
  process.exit(2);
}
Promise.resolve(commands[command]()).catch(() => fail("The setup stopped unexpectedly. Nothing further was changed."));
