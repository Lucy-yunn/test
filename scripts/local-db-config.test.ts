import { describe, it, expect } from "vitest";
import { buildLocalDatabaseUrl, planLocalEnv } from "./local-db-config";
import { assertLocalDatabaseUrl } from "./local-db-guard";

describe("buildLocalDatabaseUrl", () => {
  it("builds a URL that the safety guard accepts, for both roles", () => {
    for (const role of ["dev", "test"] as const) {
      const url = buildLocalDatabaseUrl(role, { user: "postgres", password: "pw", port: 5432 });
      expect(() => assertLocalDatabaseUrl("X", url, role)).not.toThrow();
    }
  });

  it("names the right database for each role", () => {
    expect(buildLocalDatabaseUrl("dev", { user: "postgres", password: "pw", port: 5432 })).toMatch(/\/ivo_dev$/);
    expect(buildLocalDatabaseUrl("test", { user: "postgres", password: "pw", port: 5432 })).toMatch(/\/ivo_test$/);
  });

  it("uses 127.0.0.1 and the port it is given", () => {
    expect(buildLocalDatabaseUrl("dev", { user: "postgres", password: "pw", port: 5433 })).toContain("@127.0.0.1:5433/");
  });

  it.each([
    ["p@ss:word/with#odd?chars%and space"],
    ["a@b"],
    ["100%"],
    ["ünïcode-密碼"],
    ["quote\"and'apostrophe"],
    ["back\\slash"],
  ])("encodes the password %s so that it reads back exactly", (password) => {
    const url = buildLocalDatabaseUrl("test", { user: "postgres", password, port: 5432 });
    expect(new URL(url).hostname).toBe("127.0.0.1"); // an odd password cannot change the host
    expect(decodeURIComponent(new URL(url).password)).toBe(password);
    expect(() => assertLocalDatabaseUrl("X", url, "test")).not.toThrow();
  });

  it("encodes an unusual user name too", () => {
    const url = buildLocalDatabaseUrl("dev", { user: "my user@x", password: "pw", port: 5432 });
    expect(decodeURIComponent(new URL(url).username)).toBe("my user@x");
    expect(new URL(url).hostname).toBe("127.0.0.1");
  });

  it("refuses an empty user or password, and a bad port", () => {
    expect(() => buildLocalDatabaseUrl("dev", { user: "", password: "pw", port: 5432 })).toThrow();
    expect(() => buildLocalDatabaseUrl("dev", { user: "postgres", password: "", port: 5432 })).toThrow();
    for (const port of [0, -1, 70000, 5432.5, Number.NaN]) {
      expect(() => buildLocalDatabaseUrl("dev", { user: "postgres", password: "pw", port })).toThrow();
    }
  });

  it("never puts the password in an error message", () => {
    let message = "";
    try {
      buildLocalDatabaseUrl("dev", { user: "", password: "hunter2-secret", port: 5432 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("hunter2-secret");
  });
});

describe("planLocalEnv: what to write into each env file", () => {
  const plan = planLocalEnv({ user: "postgres", password: "pw", port: 5432 });

  it("points .env.local at ivo_dev, for both the app and migrations", () => {
    expect(Object.keys(plan.envLocal).sort()).toEqual(["DATABASE_URL", "DIRECT_URL"]);
    expect(plan.envLocal.DATABASE_URL).toMatch(/\/ivo_dev$/);
    expect(plan.envLocal.DIRECT_URL).toBe(plan.envLocal.DATABASE_URL);
  });

  it("points .env.test.local at ivo_test, and overwrites any old TEST_DIRECT_URL so a leftover Neon one cannot remain", () => {
    expect(Object.keys(plan.envTestLocal).sort()).toEqual(["TEST_DATABASE_URL", "TEST_DIRECT_URL"]);
    expect(plan.envTestLocal.TEST_DATABASE_URL).toMatch(/\/ivo_test$/);
    expect(plan.envTestLocal.TEST_DIRECT_URL).toBe(plan.envTestLocal.TEST_DATABASE_URL);
  });

  it("only ever contains URLs the safety guard accepts", () => {
    expect(() => assertLocalDatabaseUrl("DATABASE_URL", plan.envLocal.DATABASE_URL, "dev")).not.toThrow();
    expect(() => assertLocalDatabaseUrl("DIRECT_URL", plan.envLocal.DIRECT_URL, "dev")).not.toThrow();
    expect(() => assertLocalDatabaseUrl("TEST_DATABASE_URL", plan.envTestLocal.TEST_DATABASE_URL, "test")).not.toThrow();
    expect(() => assertLocalDatabaseUrl("TEST_DIRECT_URL", plan.envTestLocal.TEST_DIRECT_URL, "test")).not.toThrow();
  });
});
