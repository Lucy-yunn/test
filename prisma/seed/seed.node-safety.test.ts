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

const SEED_ENTRY = resolve(import.meta.dirname, "../seed.ts");

describe("prisma seed is node-safe", () => {
  it("imports without reaching server-only / a Next-only module", async () => {
    // Before the fix this threw at import: Cannot find module 'server-only'.
    const mod = await import("./seed");
    expect(typeof mod.seedDatabase).toBe("function");
    expect(typeof mod.DEMO_PASSWORD).toBe("string");
  });

  it("no file in the seed's local import graph touches server-only / next", () => {
    const graph = collectLocalGraph(SEED_ENTRY);
    // Sanity: the collector actually walked the graph (guards a false pass).
    expect(graph.size).toBeGreaterThanOrEqual(4); // seed.ts + seed/seed.ts + taxonomy + vehicles
    expect([...graph].some((f) => f.endsWith("seed.ts"))).toBe(true);
    expect([...graph].some((f) => f.endsWith("vehicles.ts"))).toBe(true);

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
