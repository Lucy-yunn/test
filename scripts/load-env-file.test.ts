import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFileOverriding } from "./load-env-file";
import { resolveDevDbEnv } from "./resolve-dev-db-env";

const LOCAL_DEV = "postgresql://postgres:pw@127.0.0.1:5432/ivo_dev";
const PLACEHOLDER = "postgresql://u:p@127.0.0.1:1/placeholder";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "envfile-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (text: string) => {
  const path = join(dir, ".env.test-file");
  writeFileSync(path, text, "utf8");
  return path;
};

describe("loadEnvFileOverriding: the file wins over what is already in the environment", () => {
  it("replaces a value that is already set", () => {
    const env: Record<string, string | undefined> = { A: "old" };
    loadEnvFileOverriding(file('A="new"\n'), env);
    expect(env.A).toBe("new");
  });

  it("adds a value that was not set, and leaves other variables alone", () => {
    const env: Record<string, string | undefined> = { KEEP: "me" };
    loadEnvFileOverriding(file('B=2\n'), env);
    expect(env).toEqual({ KEEP: "me", B: "2" });
  });

  it("reads quotes, comments and blank lines the way a .env file is written", () => {
    const env: Record<string, string | undefined> = {};
    loadEnvFileOverriding(file('# a comment\n\nA="quoted value"\nB=plain\nC=\'single\'\n'), env);
    expect(env).toEqual({ A: "quoted value", B: "plain", C: "single" });
  });

  it("does nothing when the file does not exist", () => {
    const env: Record<string, string | undefined> = { A: "1" };
    expect(loadEnvFileOverriding(join(dir, "missing"), env)).toEqual([]);
    expect(env).toEqual({ A: "1" });
  });

  it("returns the names it set, never the values", () => {
    const env: Record<string, string | undefined> = {};
    const names = loadEnvFileOverriding(file('SECRET="hunter2"\nOTHER=x\n'), env);
    expect(names.sort()).toEqual(["OTHER", "SECRET"]);
    expect(JSON.stringify(names)).not.toContain("hunter2");
  });

  it("regression: a placeholder that Prisma injected from .env no longer beats .env.local", () => {
    // Importing @prisma/client copies .env into the environment first (a placeholder
    // pointing at 127.0.0.1:1/placeholder). Loading .env.local afterwards must replace it.
    const env: Record<string, string | undefined> = { DATABASE_URL: PLACEHOLDER, DIRECT_URL: PLACEHOLDER };
    loadEnvFileOverriding(file(`DATABASE_URL="${LOCAL_DEV}"\nDIRECT_URL="${LOCAL_DEV}"\n`), env);
    expect(() => resolveDevDbEnv(env)).not.toThrow();
    expect(resolveDevDbEnv(env).DATABASE_URL).toBe(LOCAL_DEV);
  });

  it("the guard still refuses when the file itself points somewhere unsafe", () => {
    const env: Record<string, string | undefined> = { DATABASE_URL: LOCAL_DEV };
    loadEnvFileOverriding(file('DATABASE_URL="postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb"\n'), env);
    expect(() => resolveDevDbEnv(env)).toThrow(/local ivo_dev/);
  });
});
