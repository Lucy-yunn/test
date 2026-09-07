import { describe, it, expect } from "vitest";
import { blankToNull } from "./listings";

describe("blankToNull (optional string / decimal columns)", () => {
  it("maps blank, whitespace-only, undefined and null to null", () => {
    expect(blankToNull("")).toBeNull();
    expect(blankToNull("   ")).toBeNull();
    expect(blankToNull("\t\n")).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull(null)).toBeNull();
  });

  it("keeps real values, trimmed — including zero", () => {
    expect(blankToNull("12.5")).toBe("12.5");
    expect(blankToNull("  120.00  ")).toBe("120.00");
    expect(blankToNull("0")).toBe("0");
    expect(blankToNull("0.000")).toBe("0.000");
  });
});
