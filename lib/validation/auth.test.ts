import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "./auth";

describe("registerSchema", () => {
  const base = { email: "a@b.co", password: "password1", name: "Ada", terms: "on" };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("requires the terms checkbox", () => {
    const r = registerSchema.safeParse({ ...base, terms: undefined });
    expect(r.success).toBe(false);
  });

  it("rejects a short password and a bad email", () => {
    expect(registerSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("only needs a valid email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("requires new == confirm and min length", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "brandnew1",
        confirmPassword: "brandnew1",
      }).success,
    ).toBe(true);

    const mismatch = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "brandnew1",
      confirmPassword: "different1",
    });
    expect(mismatch.success).toBe(false);
  });
});
