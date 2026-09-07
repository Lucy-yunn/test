import { describe, it, expect } from "vitest";
import { parseStaffFromEnv } from "./staff";

describe("parseStaffFromEnv", () => {
  it("reads consecutive STAFF_<n>_* triples", () => {
    const staff = parseStaffFromEnv({
      STAFF_1_EMAIL: "Lucy@ivo.example",
      STAFF_1_NAME: "Lucy",
      STAFF_1_PASSWORD: "a-good-password",
      STAFF_2_EMAIL: "ivo@ivo.example",
      STAFF_2_NAME: "Ivo",
      STAFF_2_PASSWORD: "another-good-one",
    });
    expect(staff).toEqual([
      { email: "lucy@ivo.example", name: "Lucy", password: "a-good-password" },
      { email: "ivo@ivo.example", name: "Ivo", password: "another-good-one" },
    ]);
  });

  it("stops at the first gap and returns [] when none are set", () => {
    expect(parseStaffFromEnv({})).toEqual([]);
    expect(
      parseStaffFromEnv({
        STAFF_1_EMAIL: "a@b.c",
        STAFF_1_NAME: "A",
        STAFF_1_PASSWORD: "12345678",
        STAFF_3_EMAIL: "c@d.e",
        STAFF_3_NAME: "C",
        STAFF_3_PASSWORD: "12345678",
      }),
    ).toHaveLength(1);
  });

  it("throws on an incomplete triple", () => {
    expect(() =>
      parseStaffFromEnv({ STAFF_1_EMAIL: "a@b.c", STAFF_1_NAME: "A" }),
    ).toThrow(/incomplete/);
  });

  it("throws on a short password", () => {
    expect(() =>
      parseStaffFromEnv({ STAFF_1_EMAIL: "a@b.c", STAFF_1_NAME: "A", STAFF_1_PASSWORD: "short" }),
    ).toThrow(/8 characters/);
  });
});
