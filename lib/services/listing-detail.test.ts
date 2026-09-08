import { describe, it, expect } from "vitest";
import { maskVin } from "./listing-detail";

describe("maskVin", () => {
  it("returns null for blank / whitespace / null", () => {
    expect(maskVin(null)).toBeNull();
    expect(maskVin(undefined)).toBeNull();
    expect(maskVin("  ")).toBeNull();
  });

  it("keeps the first 3 and last 4, masks the middle", () => {
    expect(maskVin("WVWZZZ1KZ9W123456")).toBe("WVW••••••••••3456");
    expect(maskVin("WVWZZZ00ZZ0000002011")).toBe("WVW•••••••••••••2011"); // 20 chars → 13 masked
  });

  it("handles a short value without leaking it", () => {
    expect(maskVin("ABC")).toBe("A••");
    expect(maskVin("ABCDEFG")).toBe("A••••••");
  });
});
