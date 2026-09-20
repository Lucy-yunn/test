import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * Loads a .env file into an environment object, and lets the file WIN over any value that
 * is already there. Returns the names it set, never the values.
 *
 * Why not `process.loadEnvFile`: it never overwrites an existing variable. Importing
 * `@prisma/client` copies `.env` (which holds a placeholder address) into the environment
 * first, so `.env.local` was silently ignored and the safety guard, correctly, refused the
 * placeholder. `.env.local` must beat `.env`, exactly as it does in Next.js.
 *
 * The guards still run on whatever ends up in the environment, so a file that points
 * somewhere unsafe is refused just the same.
 */
export function loadEnvFileOverriding(path: string, env: Record<string, string | undefined> = process.env): string[] {
  if (!existsSync(path)) return [];
  const parsed = parseEnv(readFileSync(path, "utf8"));
  for (const [name, value] of Object.entries(parsed)) {
    if (value !== undefined) env[name] = value;
  }
  return Object.keys(parsed);
}
