import { describe, it, expect } from "vitest";
import { resolveDevDbEnv } from "./resolve-dev-db-env";

const DEV_URL = "postgresql://postgres:pw@localhost:5432/ivo_dev";
const TEST_URL = "postgresql://postgres:pw@localhost:5432/ivo_test";
const NEON_POOLED = "postgresql://u:pw@ep-dev-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const NEON_DIRECT = "postgresql://u:pw@ep-dev.eu-central-1.aws.neon.tech/neondb?sslmode=require";

describe("resolveDevDbEnv: migrations and the dev seed may only touch the local ivo_dev", () => {
  it("passes a local ivo_dev DATABASE_URL through, with DIRECT_URL defaulting to it", () => {
    const out = resolveDevDbEnv({ DATABASE_URL: DEV_URL });
    expect(out.DATABASE_URL).toBe(DEV_URL);
    expect(out.DIRECT_URL).toBe(DEV_URL);
  });

  it("keeps an explicit local DIRECT_URL", () => {
    const direct = "postgresql://postgres:pw@127.0.0.1:5432/ivo_dev";
    expect(resolveDevDbEnv({ DATABASE_URL: DEV_URL, DIRECT_URL: direct }).DIRECT_URL).toBe(direct);
  });

  it("refuses the Neon development branch, pooled or direct", () => {
    expect(() => resolveDevDbEnv({ DATABASE_URL: NEON_POOLED, DIRECT_URL: NEON_DIRECT })).toThrow(/local ivo_dev/);
    expect(() => resolveDevDbEnv({ DATABASE_URL: NEON_DIRECT })).toThrow(/DATABASE_URL/);
  });

  it("refuses when only DIRECT_URL is remote: migrations use it, so it counts", () => {
    expect(() => resolveDevDbEnv({ DATABASE_URL: DEV_URL, DIRECT_URL: NEON_DIRECT })).toThrow(/DIRECT_URL/);
  });

  it("refuses the test database as the development database", () => {
    expect(() => resolveDevDbEnv({ DATABASE_URL: TEST_URL })).toThrow(/ivo_dev/);
  });

  it("refuses when DATABASE_URL is missing or blank: no fallback", () => {
    expect(() => resolveDevDbEnv({})).toThrow(/DATABASE_URL/);
    expect(() => resolveDevDbEnv({ DATABASE_URL: "  " })).toThrow(/DATABASE_URL/);
  });

  it("refuses the placeholder address in .env", () => {
    expect(() => resolveDevDbEnv({ DATABASE_URL: "postgresql://u:p@127.0.0.1:1/placeholder" })).toThrow(/ivo_dev/);
  });

  it("never reads TEST_DATABASE_URL", () => {
    expect(() => resolveDevDbEnv({ TEST_DATABASE_URL: TEST_URL })).toThrow(/DATABASE_URL/);
  });
});
