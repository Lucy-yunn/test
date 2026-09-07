import { describe, it, expect } from "vitest";
import { roleHomePath } from "./role-home";

describe("roleHomePath", () => {
  it("routes each role to its landing area (auth-and-permissions §10)", () => {
    expect(roleHomePath("staff")).toBe("/admin");
    expect(roleHomePath("seller")).toBe("/seller");
    expect(roleHomePath("buyer")).toBe("/");
  });

  it("prefers a safe same-origin redirect target for a buyer", () => {
    expect(roleHomePath("buyer", "/listing/abc")).toBe("/listing/abc");
    expect(roleHomePath("buyer", "/account/orders")).toBe("/account/orders");
  });

  it("ignores a redirect target for staff and seller (always their area)", () => {
    expect(roleHomePath("staff", "/listing/abc")).toBe("/admin");
    expect(roleHomePath("seller", "/account/orders")).toBe("/seller");
  });

  it("rejects an unsafe redirect target (open-redirect / not a path)", () => {
    expect(roleHomePath("buyer", "https://evil.example")).toBe("/");
    expect(roleHomePath("buyer", "//evil.example")).toBe("/");
    expect(roleHomePath("buyer", "javascript:alert(1)")).toBe("/");
    expect(roleHomePath("buyer", "not-a-path")).toBe("/");
  });
});
