import { describe, it, expect } from "vitest";
import { setEnvValues } from "./env-file";

describe("setEnvValues: rewrite only the variables asked for, and leave every other line untouched", () => {
  const original = [
    "# Development environment",
    'DATABASE_URL="old-value"',
    'DIRECT_URL="old-direct"',
    "",
    "# Better Auth",
    'BETTER_AUTH_SECRET="keep-me-exactly"',
    "a-stray-line-without-equals",
    'STAFF_1_EMAIL="someone@example.test"',
    "",
  ].join("\n");

  it("replaces the value of an existing variable", () => {
    const out = setEnvValues(original, { DATABASE_URL: "new-value" });
    expect(out).toContain('DATABASE_URL="new-value"');
    expect(out).not.toContain("old-value");
  });

  it("changes nothing else: comments, other variables, blank lines and stray lines are byte-identical", () => {
    const out = setEnvValues(original, { DATABASE_URL: "new-value", DIRECT_URL: "new-direct" });
    const before = original.split("\n");
    const after = out.split("\n");
    expect(after).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) {
      if (before[i].startsWith("DATABASE_URL=") || before[i].startsWith("DIRECT_URL=")) continue;
      expect(after[i]).toBe(before[i]);
    }
  });

  it("appends a variable that is not there yet", () => {
    const out = setEnvValues(original, { TEST_DATABASE_URL: "postgresql://x" });
    expect(out.endsWith('TEST_DATABASE_URL="postgresql://x"\n')).toBe(true);
    expect(out.startsWith(original)).toBe(true);
  });

  it("starts a new file when there is none", () => {
    expect(setEnvValues("", { A: "1", B: "2" })).toBe('A="1"\nB="2"\n');
  });

  it("does not add a blank line when the file already ends with one", () => {
    expect(setEnvValues("X=1\n", { A: "2" })).toBe('X=1\nA="2"\n');
    expect(setEnvValues("X=1", { A: "2" })).toBe('X=1\nA="2"\n');
  });

  it("keeps Windows line endings", () => {
    const crlf = 'A="1"\r\nB="2"\r\n';
    const out = setEnvValues(crlf, { A: "9", C: "3" });
    expect(out).toBe('A="9"\r\nB="2"\r\nC="3"\r\n');
  });

  it("updates every occurrence of a duplicated variable, so none of them is left pointing at the old value", () => {
    const out = setEnvValues('A="1"\nA="2"\n', { A: "9" });
    expect(out).toBe('A="9"\nA="9"\n');
  });

  it("is not fooled by a variable whose name merely starts with the same letters", () => {
    const out = setEnvValues('DATABASE_URL_OLD="keep"\nDATABASE_URL="x"\n', { DATABASE_URL: "y" });
    expect(out).toBe('DATABASE_URL_OLD="keep"\nDATABASE_URL="y"\n');
  });

  it("does not touch a commented-out variable", () => {
    const out = setEnvValues('# DATABASE_URL="old"\nDATABASE_URL="x"\n', { DATABASE_URL: "y" });
    expect(out).toBe('# DATABASE_URL="old"\nDATABASE_URL="y"\n');
  });

  it("refuses a value that would break the file", () => {
    expect(() => setEnvValues("", { A: 'has"quote' })).toThrow();
    expect(() => setEnvValues("", { A: "has\nnewline" })).toThrow();
    expect(() => setEnvValues("", { A: "has\rreturn" })).toThrow();
  });

  it("refuses a variable name that is not a plain name", () => {
    expect(() => setEnvValues("", { "bad name": "1" })).toThrow();
    expect(() => setEnvValues("", { "A=B": "1" })).toThrow();
  });

  it("never puts a value in an error message", () => {
    let message = "";
    try {
      setEnvValues("", { A: 'secret-with"quote' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("secret-with");
  });
});
