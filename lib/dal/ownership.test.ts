import { describe, it, expect } from "vitest";
import { assertOwnsSellerData, assertOwnsBuyerData } from "./ownership";
import { ForbiddenError } from "./errors";
import type { Actor } from "./actor";

const buyer: Actor = { userId: "u1", role: "buyer", buyerId: "b1", sellerId: null, messagingBlocked: false };
const otherBuyer: Actor = { userId: "u2", role: "buyer", buyerId: "b2", sellerId: null, messagingBlocked: false };
const seller: Actor = { userId: "u3", role: "seller", buyerId: null, sellerId: "s1", messagingBlocked: false };
const otherSeller: Actor = { userId: "u4", role: "seller", buyerId: null, sellerId: "s2", messagingBlocked: false };
const staff: Actor = { userId: "u5", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false };

describe("assertOwnsSellerData", () => {
  it("allows the seller who owns it, and staff (sees all — order-model §11)", () => {
    expect(() => assertOwnsSellerData(seller, "s1")).not.toThrow();
    expect(() => assertOwnsSellerData(staff, "s1")).not.toThrow();
  });
  it("forbids another seller and a buyer", () => {
    expect(() => assertOwnsSellerData(otherSeller, "s1")).toThrow(ForbiddenError);
    expect(() => assertOwnsSellerData(buyer, "s1")).toThrow(ForbiddenError);
  });
});

describe("assertOwnsBuyerData", () => {
  it("allows the buyer who owns it, and staff", () => {
    expect(() => assertOwnsBuyerData(buyer, "b1")).not.toThrow();
    expect(() => assertOwnsBuyerData(staff, "b1")).not.toThrow();
  });
  it("forbids another buyer and a seller", () => {
    expect(() => assertOwnsBuyerData(otherBuyer, "b1")).toThrow(ForbiddenError);
    expect(() => assertOwnsBuyerData(seller, "b1")).toThrow(ForbiddenError);
  });
});
