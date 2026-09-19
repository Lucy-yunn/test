import { describe, it, expect } from "vitest";
import { matchesMileageBand, parseMileageBand } from "./seller-profile";

describe("matchesMileageBand — under 100,000 · 100,000–200,000 · over 200,000 km", () => {
  it.each([
    ["under100k", 0, true],
    ["under100k", 99_999, true],
    ["under100k", 100_000, false],
    ["100to200k", 99_999, false],
    ["100to200k", 100_000, true],
    ["100to200k", 200_000, true],
    ["100to200k", 200_001, false],
    ["over200k", 200_000, false],
    ["over200k", 200_001, true],
  ] as const)("%s at %i km is %s", (band, km, expected) => {
    expect(matchesMileageBand(km, band)).toBe(expected);
  });

  it("never matches a car with unknown mileage", () => {
    for (const band of ["under100k", "100to200k", "over200k"] as const) {
      expect(matchesMileageBand(null, band)).toBe(false);
    }
  });
});

describe("parseMileageBand — reads the URL value", () => {
  it("accepts the three bands and ignores anything else", () => {
    expect(parseMileageBand("under100k")).toBe("under100k");
    expect(parseMileageBand("100to200k")).toBe("100to200k");
    expect(parseMileageBand("over200k")).toBe("over200k");
    expect(parseMileageBand("banana")).toBeUndefined();
    expect(parseMileageBand(undefined)).toBeUndefined();
  });
});
