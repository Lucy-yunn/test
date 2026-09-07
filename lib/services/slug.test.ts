import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases, trims, and hyphenates", () => {
    expect(slugify("Volkswagen")).toBe("volkswagen");
    expect(slugify("  A4, S4  ")).toBe("a4-s4");
    expect(slugify("Mercedes-Benz")).toBe("mercedes-benz");
    expect(slugify("A4 S4 B5 8D (1994–1999)")).toBe("a4-s4-b5-8d-1994-1999");
  });

  it("strips accents to ascii", () => {
    expect(slugify("Citroën")).toBe("citroen");
    expect(slugify("Škoda Octavia")).toBe("skoda-octavia");
  });

  it("collapses runs of separators and trims leading/trailing hyphens", () => {
    expect(slugify("--foo // bar--")).toBe("foo-bar");
    expect(slugify("a  ---  b")).toBe("a-b");
  });

  it("returns empty string when nothing usable remains", () => {
    expect(slugify("—")).toBe("");
    expect(slugify("")).toBe("");
  });
});
