import { describe, it, expect } from "vitest";
import {
  attributeSchemaFor,
  validateAttributes,
  DEFAULT_ATTRIBUTE_SCHEMA,
} from "./part-attributes";
import { InvariantError } from "./errors";

describe("attributeSchemaFor", () => {
  it("returns the permissive default for an un-modelled category", () => {
    expect(attributeSchemaFor("water-pump")).toBe(DEFAULT_ATTRIBUTE_SCHEMA);
  });

  it("returns a specific schema for a modelled category", () => {
    expect(attributeSchemaFor("headlight")).not.toBe(DEFAULT_ATTRIBUTE_SCHEMA);
  });
});

describe("validateAttributes", () => {
  it("accepts an empty object and a valid scalar map (default schema)", () => {
    expect(validateAttributes("water-pump", {})).toEqual({});
    expect(validateAttributes("water-pump", { note: "reman", flow: 120 })).toEqual({
      note: "reman",
      flow: 120,
    });
    expect(validateAttributes("water-pump", undefined)).toEqual({});
  });

  it("enforces a modelled schema and rejects unknown keys", () => {
    expect(validateAttributes("headlight", { side: "left", technology: "xenon" })).toEqual({
      side: "left",
      technology: "xenon",
    });
    expect(() => validateAttributes("headlight", { side: "up" })).toThrow(InvariantError);
    expect(() => validateAttributes("headlight", { bogus: 1 })).toThrow(InvariantError);
  });

  it("rejects a non-object for the default schema", () => {
    expect(() => validateAttributes("water-pump", "nope")).toThrow(InvariantError);
  });
});
