import { describe, it, expect } from "vitest";
import { InvariantError } from "./errors";
import {
  sellerIsAvailable,
  assertSellerStateAvailable,
  NO_ACTIVE_LOGIN_MESSAGE,
  SELLER_AVAILABILITY_SELECT,
} from "./seller-availability";

describe("sellerIsAvailable: a seller is available when it has a linked login that is not disabled", () => {
  it.each([
    ["no login at all", { userId: null, user: null }, false],
    ["a login that staff disabled", { userId: "u1", user: { banned: true } }, false],
    ["an active login", { userId: "u1", user: { banned: false } }, true],
  ])("%s", (_label, state, expected) => {
    expect(sellerIsAvailable(state)).toBe(expected);
  });

  it("a link with no readable user is not treated as disabled (unchanged from the original rule)", () => {
    expect(sellerIsAvailable({ userId: "u1", user: null })).toBe(true);
  });
});

describe("assertSellerStateAvailable", () => {
  it("passes for an available seller", () => {
    expect(() => assertSellerStateAvailable({ userId: "u1", user: { banned: false } })).not.toThrow();
  });

  it.each([
    [{ userId: null, user: null }],
    [{ userId: "u1", user: { banned: true } }],
  ])("throws the same invariant error for an unavailable seller", (state) => {
    expect(() => assertSellerStateAvailable(state)).toThrow(InvariantError);
    expect(() => assertSellerStateAvailable(state)).toThrow(NO_ACTIVE_LOGIN_MESSAGE);
  });
});

describe("SELLER_AVAILABILITY_SELECT: what a query must load to decide", () => {
  it("asks for exactly the link and the disabled flag, so every caller loads the same fields", () => {
    expect(SELLER_AVAILABILITY_SELECT).toEqual({ userId: true, user: { select: { banned: true } } });
  });
});
