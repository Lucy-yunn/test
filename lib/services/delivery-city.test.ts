import { describe, it, expect } from "vitest";
import { parseDetectedCity, resolveDeliveryCity } from "./delivery-city";

describe("parseDetectedCity — the city Vercel derives from the visitor's IP", () => {
  it("returns the plain city name", () => {
    expect(parseDetectedCity("Sofia")).toBe("Sofia");
  });

  it("decodes the URL-encoded value Vercel sends", () => {
    expect(parseDetectedCity("Stara%20Zagora")).toBe("Stara Zagora");
    expect(parseDetectedCity("Ruse%2C%20BG")).toBe("Ruse, BG");
  });

  it("is null when the header is missing or blank", () => {
    expect(parseDetectedCity(null)).toBeNull();
    expect(parseDetectedCity(undefined)).toBeNull();
    expect(parseDetectedCity("   ")).toBeNull();
  });

  it("is null rather than throwing on a malformed encoding", () => {
    expect(parseDetectedCity("%E0%A4%A")).toBeNull();
  });
});

describe("resolveDeliveryCity — a city the buyer chose always wins over a guess", () => {
  it("prefers the signed-in buyer's saved city", () => {
    expect(resolveDeliveryCity({ savedCity: "Varna", cookieCity: "Ruse", detectedCity: "Sofia" })).toEqual({
      city: "Varna",
      source: "chosen",
    });
  });

  it("then the city chosen in this browser", () => {
    expect(resolveDeliveryCity({ savedCity: null, cookieCity: "Ruse", detectedCity: "Sofia" })).toEqual({
      city: "Ruse",
      source: "chosen",
    });
  });

  it("then the IP-detected suggestion, marked as a guess", () => {
    expect(resolveDeliveryCity({ savedCity: null, cookieCity: null, detectedCity: "Sofia" })).toEqual({
      city: "Sofia",
      source: "detected",
    });
  });

  it("has no city when nothing is known", () => {
    expect(resolveDeliveryCity({ savedCity: null, cookieCity: null, detectedCity: null })).toEqual({
      city: null,
      source: null,
    });
  });

  it("ignores blank values", () => {
    expect(resolveDeliveryCity({ savedCity: " ", cookieCity: "", detectedCity: "Sofia" }).source).toBe("detected");
  });
});
