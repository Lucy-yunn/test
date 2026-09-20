import { describe, it, expect } from "vitest";
import { blankToNull, firstLine } from "./text";

describe("blankToNull: an optional text field left blank means unknown, never an empty string", () => {
  it("maps blank, whitespace-only, undefined and null to null", () => {
    expect(blankToNull("")).toBeNull();
    expect(blankToNull("   ")).toBeNull();
    expect(blankToNull("\t\n")).toBeNull();
    expect(blankToNull(undefined)).toBeNull();
    expect(blankToNull(null)).toBeNull();
  });

  it("keeps real values, trimmed, including zero", () => {
    expect(blankToNull("12.5")).toBe("12.5");
    expect(blankToNull("  120.00  ")).toBe("120.00");
    expect(blankToNull("0")).toBe("0");
    expect(blankToNull("0.000")).toBe("0.000");
  });

  it("only trims the ends: inner spacing and line breaks are kept", () => {
    expect(blankToNull("  two  words\nnext line ")).toBe("two  words\nnext line");
  });
});

describe("firstLine: the first line of a multi-line text, for a card", () => {
  it("returns the first line, trimmed", () => {
    expect(firstLine("Flood damage in 2023\nWater reached the dashboard")).toBe("Flood damage in 2023");
    expect(firstLine("  padded first line  \nsecond")).toBe("padded first line");
  });

  it("understands Windows line endings", () => {
    expect(firstLine("first\r\nsecond")).toBe("first");
  });

  it("returns a single-line text as it is", () => {
    expect(firstLine("only line")).toBe("only line");
  });

  it("is null for nothing, blank, or a text that starts with a blank line", () => {
    expect(firstLine(null)).toBeNull();
    expect(firstLine(undefined)).toBeNull();
    expect(firstLine("")).toBeNull();
    expect(firstLine("   ")).toBeNull();
    expect(firstLine("\nsecond line only")).toBeNull();
  });
});
