import { describe, it, expect } from "vitest";
import { generateInitialPassword } from "./credentials";

describe("generateInitialPassword", () => {
  it("returns a long, non-trivial string", () => {
    const pw = generateInitialPassword();
    expect(pw.length).toBeGreaterThanOrEqual(16);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/); // no ambiguous punctuation to relay by phone
  });

  it("is different every call", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateInitialPassword()));
    expect(set.size).toBe(50);
  });
});
