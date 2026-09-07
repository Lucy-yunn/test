import { describe, it, expect } from "vitest";
import { assertPostgresUrl } from "./connection-string";

const OK = "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("assertPostgresUrl", () => {
  it("accepts a single well-formed postgres URL", () => {
    expect(assertPostgresUrl("DATABASE_URL", OK)).toBe(OK);
    expect(assertPostgresUrl("DATABASE_URL", "postgres://u:p@host:5432/db")).toBeTruthy();
  });

  it("trims surrounding whitespace", () => {
    expect(assertPostgresUrl("DATABASE_URL", `  ${OK}\n`)).toBe(OK);
  });

  it("rejects a value pasted more than once (the reported bug)", () => {
    expect(() => assertPostgresUrl("DATABASE_URL", OK + OK)).toThrow(/more than once/);
    expect(() => assertPostgresUrl("DATABASE_URL", OK + OK + OK)).toThrow(/3 ":\/\/"/);
  });

  it("rejects empty / unset", () => {
    expect(() => assertPostgresUrl("DATABASE_URL", undefined)).toThrow(/not set/);
    expect(() => assertPostgresUrl("DATABASE_URL", "   ")).toThrow(/not set/);
  });

  it("rejects a non-postgres scheme", () => {
    expect(() => assertPostgresUrl("DATABASE_URL", "mysql://u:p@h/db")).toThrow(/postgres/);
    expect(() => assertPostgresUrl("DATABASE_URL", "http://h/db")).toThrow();
  });

  it("rejects internal whitespace (pasted extra text)", () => {
    expect(() => assertPostgresUrl("DATABASE_URL", "postgres://u:p@h/db extra")).toThrow(
      /whitespace|more than once/,
    );
  });

  it("rejects a value with no host", () => {
    expect(() => assertPostgresUrl("DATABASE_URL", "postgresql:///db")).toThrow(/host/);
  });
});
