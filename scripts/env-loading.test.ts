import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `process.loadEnvFile` never overwrites a variable that is already set, and importing
 * `@prisma/client` copies `.env` (a placeholder address) into the environment first. So the
 * database scripts must load their env file with `loadEnvFileOverriding` instead, or
 * `.env.local` is silently ignored. This keeps that from coming back.
 */
const files = [
  ...readdirSync("scripts")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join("scripts", f)),
  "vitest.integration.setup.ts",
];

describe("database scripts load their env file so that it wins", () => {
  it.each(files)("%s does not call process.loadEnvFile directly", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/process\.loadEnvFile\s*\(/);
  });
});
