import { describe, it, expect } from "vitest";
import {
  ORDER_TRANSITIONS,
  LISTING_TRANSITIONS,
  PART_STATUS_TRANSITIONS,
  canTransition,
  assertTransition,
} from "./transitions";
import { InvariantError } from "./errors";

describe("order status machine", () => {
  it("allows the pre-ship path and pre-ship cancellation", () => {
    expect(canTransition(ORDER_TRANSITIONS, "placed", "confirmed")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "confirmed", "shipped")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "shipped", "delivered")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "placed", "cancelled")).toBe(true);
    expect(canTransition(ORDER_TRANSITIONS, "confirmed", "cancelled")).toBe(true);
  });

  it("forbids cancelling once shipped, skipping states, and leaving terminal states", () => {
    expect(canTransition(ORDER_TRANSITIONS, "shipped", "cancelled")).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, "placed", "shipped")).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, "placed", "delivered")).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, "delivered", "cancelled")).toBe(false);
    expect(canTransition(ORDER_TRANSITIONS, "cancelled", "placed")).toBe(false);
  });
});

describe("listing status machine", () => {
  it("covers the documented edges", () => {
    expect(canTransition(LISTING_TRANSITIONS, "draft", "published")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "published", "reserved")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "reserved", "sold")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "reserved", "published")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "published", "cancelled")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "cancelled", "published")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "published", "archived")).toBe(true);
    expect(canTransition(LISTING_TRANSITIONS, "cancelled", "archived")).toBe(true);
  });

  it("forbids skipping draft, un-selling, and re-listing a sold item", () => {
    expect(canTransition(LISTING_TRANSITIONS, "draft", "reserved")).toBe(false);
    expect(canTransition(LISTING_TRANSITIONS, "sold", "published")).toBe(false);
    expect(canTransition(LISTING_TRANSITIONS, "sold", "archived")).toBe(false);
    expect(canTransition(LISTING_TRANSITIONS, "published", "sold")).toBe(false);
  });
});

describe("part status machine", () => {
  it("only allows provisional -> confirmed, never back", () => {
    expect(canTransition(PART_STATUS_TRANSITIONS, "provisional", "confirmed")).toBe(true);
    expect(canTransition(PART_STATUS_TRANSITIONS, "confirmed", "provisional")).toBe(false);
    expect(canTransition(PART_STATUS_TRANSITIONS, "provisional", "provisional")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("passes a valid transition and throws InvariantError on an invalid one", () => {
    expect(() => assertTransition(ORDER_TRANSITIONS, "placed", "confirmed", "Order")).not.toThrow();
    expect(() => assertTransition(ORDER_TRANSITIONS, "shipped", "cancelled", "Order")).toThrow(
      InvariantError,
    );
    expect(() => assertTransition(ORDER_TRANSITIONS, "shipped", "cancelled", "Order")).toThrow(
      /Order.*shipped.*cancelled/,
    );
  });
});
