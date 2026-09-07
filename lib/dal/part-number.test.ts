import { describe, it, expect } from "vitest";
import { normalizePartNumber } from "./part-number";

describe("normalizePartNumber", () => {
  it("uppercases and strips separators (spaces, dots, dashes, slashes)", () => {
    expect(normalizePartNumber("03l 903 023 f")).toBe("03L903023F");
    expect(normalizePartNumber("06A.115.561.B")).toBe("06A115561B");
    expect(normalizePartNumber("1K0-820-859-S")).toBe("1K0820859S");
    expect(normalizePartNumber("A 642 090 05 51")).toBe("A6420900551");
  });

  it("is idempotent", () => {
    const once = normalizePartNumber("5K1 941 005");
    expect(normalizePartNumber(once)).toBe(once);
  });

  it("trims surrounding whitespace", () => {
    expect(normalizePartNumber("  03L903023F \n")).toBe("03L903023F");
  });

  it("returns empty string for a value with no alphanumerics", () => {
    expect(normalizePartNumber("--- / ---")).toBe("");
    expect(normalizePartNumber("")).toBe("");
  });

  it("keeps digits and letters only, drops every other character", () => {
    expect(normalizePartNumber("ABC#123*456")).toBe("ABC123456");
  });
});
