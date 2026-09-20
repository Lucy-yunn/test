import { describe, it, expect } from "vitest";
import type { Actor } from "../dal/actor";
import { sellerContactFor, phoneHref } from "./seller-contact";

const PHONE = "+359 88 555 0101";
const actor = (role: Actor["role"]): Actor => ({
  userId: "u",
  role,
  buyerId: role === "buyer" ? "b" : null,
  sellerId: role === "seller" ? "s" : null,
  messagingBlocked: false,
});

describe("sellerContactFor: the seller's phone is for signed-in users only (ADR-0011)", () => {
  it("gives an anonymous visitor a sign-in prompt, never the number", () => {
    const contact = sellerContactFor(null, PHONE);
    expect(contact).toEqual({ kind: "sign_in" });
    expect(JSON.stringify(contact)).not.toContain("359");
  });

  it("gives an anonymous visitor the same prompt when the seller has no phone, so it does not reveal that", () => {
    expect(sellerContactFor(null, null)).toEqual({ kind: "sign_in" });
  });

  it.each(["buyer", "seller", "staff"] as const)("gives a signed-in %s the number", (role) => {
    expect(sellerContactFor(actor(role), PHONE)).toEqual({ kind: "phone", phone: PHONE });
  });

  it("tells a signed-in user when the seller has no phone on file", () => {
    for (const blank of [null, undefined, "", "   "]) {
      expect(sellerContactFor(actor("buyer"), blank)).toEqual({ kind: "none" });
    }
  });

  it("trims the number", () => {
    expect(sellerContactFor(actor("buyer"), "  +359 88 555 0101  ")).toEqual({ kind: "phone", phone: PHONE });
  });
});

describe("phoneHref: a tap-to-call link", () => {
  it("removes spaces so the dialler gets one number", () => {
    expect(phoneHref("+359 88 555 0101")).toBe("tel:+359885550101");
    expect(phoneHref("+359  88\t555 0101")).toBe("tel:+359885550101");
  });
});
