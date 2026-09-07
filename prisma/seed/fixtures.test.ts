import { describe, it, expect } from "vitest";
import { GROUPS, CATEGORIES } from "./taxonomy";
import { MAKES, MODEL_GROUPS, GENERATIONS } from "./vehicles";

describe("category taxonomy fixture", () => {
  it("has unique group slugs", () => {
    const slugs = GROUPS.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has unique category slugs", () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every category points at a real group", () => {
    const groupSlugs = new Set(GROUPS.map((g) => g.slug));
    for (const c of CATEGORIES) {
      expect(groupSlugs.has(c.groupSlug), `${c.slug} -> ${c.groupSlug}`).toBe(true);
    }
  });

  it("slugs are immutable kebab-case ascii", () => {
    for (const s of [...GROUPS, ...CATEGORIES].map((x) => x.slug)) {
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("keeps the frozen catch-all", () => {
    expect(CATEGORIES.find((c) => c.slug === "other-not-listed")?.groupSlug).toBe(
      "other",
    );
  });
});

describe("vehicle catalogue fixture", () => {
  it("has unique slugs across each level", () => {
    for (const list of [MAKES, MODEL_GROUPS, GENERATIONS]) {
      const slugs = list.map((x) => x.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("model groups reference a real make", () => {
    const makeSlugs = new Set(MAKES.map((m) => m.slug));
    for (const mg of MODEL_GROUPS) expect(makeSlugs.has(mg.makeSlug)).toBe(true);
  });

  it("generations reference a real model group and have a sane date range", () => {
    const mgSlugs = new Set(MODEL_GROUPS.map((m) => m.slug));
    for (const g of GENERATIONS) {
      expect(mgSlugs.has(g.modelGroupSlug), g.slug).toBe(true);
      if (g.productionEnd !== null) {
        expect(g.productionEnd).toBeGreaterThanOrEqual(g.productionStart);
      }
    }
  });
});
