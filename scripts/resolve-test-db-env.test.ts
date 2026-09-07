import { describe, it, expect } from "vitest";
import { resolveTestDbEnv } from "./resolve-test-db-env";

const TEST_URL = "postgresql://u:p@ep-test.eu-central-1.aws.neon.tech/neondb";
const DEV_URL = "postgresql://u:p@ep-dev-pooler.eu-central-1.aws.neon.tech/neondb";

describe("resolveTestDbEnv", () => {
  it("maps TEST_DATABASE_URL onto DATABASE_URL and DIRECT_URL", () => {
    const out = resolveTestDbEnv({ TEST_DATABASE_URL: TEST_URL });
    expect(out.DATABASE_URL).toBe(TEST_URL);
    expect(out.DIRECT_URL).toBe(TEST_URL);
    expect(out.NODE_ENV).toBe("test");
  });

  it("uses TEST_DIRECT_URL for DIRECT_URL when provided", () => {
    const direct = TEST_URL + "?options=direct";
    const out = resolveTestDbEnv({
      TEST_DATABASE_URL: TEST_URL,
      TEST_DIRECT_URL: direct,
    });
    expect(out.DIRECT_URL).toBe(direct);
  });

  it("never returns the value of DATABASE_URL", () => {
    const out = resolveTestDbEnv({
      TEST_DATABASE_URL: TEST_URL,
      DATABASE_URL: DEV_URL,
    });
    expect(out.DATABASE_URL).toBe(TEST_URL);
    expect(out.DATABASE_URL).not.toBe(DEV_URL);
  });

  it("throws when TEST_DATABASE_URL is missing — no fallback to DATABASE_URL", () => {
    expect(() => resolveTestDbEnv({ DATABASE_URL: DEV_URL })).toThrow(
      /TEST_DATABASE_URL/,
    );
  });

  it("throws when TEST_DATABASE_URL is empty or whitespace", () => {
    expect(() => resolveTestDbEnv({ TEST_DATABASE_URL: "" })).toThrow();
    expect(() => resolveTestDbEnv({ TEST_DATABASE_URL: "   " })).toThrow();
  });

  it("throws when TEST_DATABASE_URL equals DATABASE_URL", () => {
    expect(() =>
      resolveTestDbEnv({ TEST_DATABASE_URL: DEV_URL, DATABASE_URL: DEV_URL }),
    ).toThrow(/equals DATABASE_URL/);
  });

  it("does not require DATABASE_URL to be present", () => {
    expect(() =>
      resolveTestDbEnv({ TEST_DATABASE_URL: TEST_URL }),
    ).not.toThrow();
  });
});
