import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Regression guard for: "Stage 6 failed with Cannot find module 'server-only'".
 *
 * `prisma db seed` runs `prisma/seed.ts` in a plain Node process. Anything it
 * imports (transitively) must be node-safe — no `server-only`, no Next runtime
 * module, no `better-auth/next-js`. Those resolve only inside Next's bundler.
 */

const ENTRYPOINTS = [
  resolve(import.meta.dirname, "../seed.ts"),
  resolve(import.meta.dirname, "../seed-staff.ts"),
];

describe("prisma seed scripts are node-safe", () => {
  it("the seed module imports without reaching server-only / a Next-only module", async () => {
    // Before the fix this threw at import: Cannot find module 'server-only'.
    const mod = await import("./seed");
    expect(typeof mod.seedDatabase).toBe("function");
    expect(typeof mod.DEMO_PASSWORD).toBe("string");
  });

  it("the staff seed module imports cleanly", async () => {
    const mod = await import("./staff");
    expect(typeof mod.seedStaff).toBe("function");
    expect(typeof mod.parseStaffFromEnv).toBe("function");
  });

  it.each(ENTRYPOINTS)("no file in %s's local import graph touches server-only / next", (entry) => {
    const graph = collectLocalGraph(entry);
    expect(graph.size).toBeGreaterThanOrEqual(2); // entry + at least one local module

    const offenders: string[] = [];
    for (const file of graph) {
      const src = readFileSync(file, "utf8");
      const rel = file.replace(resolve(import.meta.dirname, "../.."), ".");
      if (/["']server-only["']/.test(src)) offenders.push(`${rel}: server-only`);
      if (/from\s+["']next(?:\/|["'])/.test(src)) offenders.push(`${rel}: next/*`);
      if (/["']better-auth\/next-js["']/.test(src)) offenders.push(`${rel}: better-auth/next-js`);
    }
    expect(offenders).toEqual([]);
  });
});

/** Follows relative (`./`, `../`) imports only — bare specifiers are inspected as
 *  strings by the test above, which is enough to catch a Next dep sneaking in. */
function collectLocalGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);

  const src = readFileSync(entry, "utf8");
  const dir = dirname(entry);
  const importRe =
    /(?:import|export)[\s\S]*?from\s*["'](\.\.?\/[^"']+)["']|import\s*["'](\.\.?\/[^"']+)["']/g;

  for (const m of src.matchAll(importRe)) {
    const spec = m[1] ?? m[2];
    const target = resolveRelative(resolve(dir, spec));
    if (target) collectLocalGraph(target, seen);
  }
  return seen;
}

function resolveRelative(base: string): string | null {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}
