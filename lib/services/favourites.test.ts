import { describe, it, expect } from "vitest";
import { availabilityOf, findSimilarHref } from "./favourites";

describe("availabilityOf — the badge a saved part carries (docs/seller-center.md §10)", () => {
  it.each([
    ["published", "available"],
    ["reserved", "reserved"],
    ["sold", "sold"],
    ["cancelled", "unavailable"],
    ["archived", "unavailable"],
    ["draft", "unavailable"],
  ] as const)("%s listing is %s", (status, expected) => {
    expect(availabilityOf(status)).toBe(expected);
  });
});

describe("findSimilarHref — re-enters the funnel at the part's category", () => {
  it("builds a Browse URL from the donor car's make, model, generation and the part's category", () => {
    expect(
      findSimilarHref({ make: "volkswagen", model: "golf", generation: "golf-vi-5k", category: "alternator" }),
    ).toBe("/browse?make=volkswagen&model=golf&generation=golf-vi-5k&category=alternator");
  });

  it("escapes slugs that need it", () => {
    expect(findSimilarHref({ make: "a b", model: "m", generation: "g", category: "c" })).toBe(
      "/browse?make=a+b&model=m&generation=g&category=c",
    );
  });
});
