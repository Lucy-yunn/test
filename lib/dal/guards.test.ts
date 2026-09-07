import { describe, it, expect } from "vitest";
import { checkRole } from "./guards";
import type { Actor } from "./actor";

const buyer: Actor = {
  userId: "u1", role: "buyer", buyerId: "b1", sellerId: null, messagingBlocked: false,
};
const sellerWithLogin: Actor = {
  userId: "u2", role: "seller", buyerId: null, sellerId: "s1", messagingBlocked: false,
};
const sellerNoProfile: Actor = {
  userId: "u3", role: "seller", buyerId: null, sellerId: null, messagingBlocked: false,
};
const staff: Actor = {
  userId: "u4", role: "staff", buyerId: null, sellerId: null, messagingBlocked: false,
};

describe("checkRole", () => {
  it("sends an anonymous caller to login", () => {
    expect(checkRole(null, "buyer")).toBe("login");
    expect(checkRole(null, "staff")).toBe("login");
  });

  it("allows the matching role", () => {
    expect(checkRole(buyer, "buyer")).toBe("ok");
    expect(checkRole(staff, "staff")).toBe("ok");
  });

  it("forbids a mismatched role", () => {
    expect(checkRole(buyer, "staff")).toBe("forbidden");
    expect(checkRole(staff, "buyer")).toBe("forbidden");
  });

  it("requires a linked Seller profile (a provisioned login) for the seller role", () => {
    expect(checkRole(sellerWithLogin, "seller")).toBe("ok");
    expect(checkRole(sellerNoProfile, "seller")).toBe("forbidden");
  });
});
