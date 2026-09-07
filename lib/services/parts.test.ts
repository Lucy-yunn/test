import { describe, it, expect } from "vitest";
import { pnStatusFor } from "./parts";

describe("pnStatusFor", () => {
  it("is 'unknown' with no part numbers", () => {
    expect(pnStatusFor([])).toBe("unknown");
  });

  it("is 'unverified' when there are numbers but none verified", () => {
    expect(pnStatusFor([{ verified: false }, { verified: false }])).toBe("unverified");
  });

  it("is 'verified' once any number is staff-verified", () => {
    expect(pnStatusFor([{ verified: false }, { verified: true }])).toBe("verified");
  });
});
