import { describe, it, expect } from "vitest";
import { listingSchema } from "./intake";

const base = {
  partId: "p1",
  priceEur: "120.00",
  condition: "used_good",
};

describe("listingSchema — optional measurements", () => {
  it("accepts a listing with every dimension left blank", () => {
    const r = listingSchema.safeParse({
      ...base,
      lengthCm: "",
      widthCm: "",
      heightCm: "",
      weightKg: "",
    });
    expect(r.success).toBe(true);
  });

  it("accepts whitespace-only dimensions (treated as blank)", () => {
    const r = listingSchema.safeParse({ ...base, lengthCm: "   ", weightKg: "\t" });
    expect(r.success).toBe(true);
  });

  it("keeps valid decimal and zero values", () => {
    const r = listingSchema.safeParse({
      ...base,
      lengthCm: "42.5",
      widthCm: "0",
      weightKg: "0.750",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lengthCm).toBe("42.5");
      expect(r.data.widthCm).toBe("0");
      expect(r.data.weightKg).toBe("0.750");
    }
  });

  it("rejects a non-numeric dimension", () => {
    expect(listingSchema.safeParse({ ...base, lengthCm: "big" }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, weightKg: "-3" }).success).toBe(false);
  });

  it("still requires a price", () => {
    expect(listingSchema.safeParse({ ...base, priceEur: "" }).success).toBe(false);
  });
});
