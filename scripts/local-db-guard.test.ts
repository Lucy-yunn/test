import { describe, it, expect } from "vitest";
import {
  assertLocalDatabaseUrl,
  assertConnectedToLocal,
  verifyLocalConnection,
  UnsafeDatabaseError,
} from "./local-db-guard";

const PW = "s3cr3t-PW-do-not-leak";

describe("assertLocalDatabaseUrl: only the local ivo_dev / ivo_test databases are allowed", () => {
  describe("accepts", () => {
    it.each([
      ["test", `postgresql://postgres:${PW}@localhost:5432/ivo_test`],
      ["dev", `postgres://postgres:${PW}@127.0.0.1:5432/ivo_dev`],
      ["test", `postgresql://postgres:${PW}@localhost/ivo_test`],
      ["dev", `postgresql://postgres:${PW}@LOCALHOST:5433/ivo_dev`],
      ["test", `postgresql://postgres:${PW}@localhost:5432/ivo_test?schema=public`],
      ["dev", `postgresql://postgres:${PW}@localhost:5432/ivo_dev?sslmode=disable&connect_timeout=15`],
    ] as const)("the %s database at %s", (role, url) => {
      expect(() => assertLocalDatabaseUrl("DATABASE_URL", url, role)).not.toThrow();
    });

    it("reports the host, port and database it found", () => {
      expect(assertLocalDatabaseUrl("DATABASE_URL", `postgresql://postgres:${PW}@127.0.0.1:5433/ivo_dev`, "dev")).toEqual({
        host: "127.0.0.1",
        port: 5433,
        database: "ivo_dev",
      });
    });
  });

  describe("rejects remote databases", () => {
    it.each([
      ["a Neon pooled URL", `postgresql://u:${PW}@ep-example-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`],
      ["a Neon direct URL", `postgresql://u:${PW}@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require`],
      ["a Neon host even when the database name is right", `postgresql://u:${PW}@ep-x.eu-central-1.aws.neon.tech/ivo_test`],
      ["another remote host", `postgresql://u:${PW}@db.example.com:5432/ivo_test`],
      ["a private network address", `postgresql://u:${PW}@192.168.1.10:5432/ivo_test`],
      ["a public address", `postgresql://u:${PW}@18.196.10.20:5432/ivo_test`],
      ["0.0.0.0", `postgresql://u:${PW}@0.0.0.0:5432/ivo_test`],
      ["another loopback address", `postgresql://u:${PW}@127.0.0.2:5432/ivo_test`],
      ["the IPv6 loopback", `postgresql://u:${PW}@[::1]:5432/ivo_test`],
    ])("%s", (_label, url) => {
      expect(() => assertLocalDatabaseUrl("TEST_DATABASE_URL", url, "test")).toThrow(UnsafeDatabaseError);
    });

    it.each([
      ["a host that only starts with localhost", `postgresql://u:${PW}@localhost.evil.com/ivo_test`],
      ["a host that only ends with localhost", `postgresql://u:${PW}@notlocalhost/ivo_test`],
      ["a host that embeds 127.0.0.1", `postgresql://u:${PW}@127.0.0.1.nip.io/ivo_test`],
      ["localhost in the user name, a remote host after it", `postgresql://localhost@db.example.com/ivo_test`],
      ["localhost in the password, a remote host after it", `postgresql://user:localhost@db.example.com/ivo_test`],
      ["two hosts", `postgresql://u:${PW}@localhost:5432,db.example.com:5432/ivo_test`],
    ])("lookalikes: %s", (_label, url) => {
      expect(() => assertLocalDatabaseUrl("TEST_DATABASE_URL", url, "test")).toThrow(UnsafeDatabaseError);
    });

    it.each([
      ["a host override", "?host=db.example.com"],
      ["an address override", "?hostaddr=18.196.10.20"],
      ["a database override", "?dbname=neondb"],
      ["a port override", "?port=6543"],
      ["a service file", "?service=production"],
      ["the word neon.tech hidden in a parameter", "?application_name=neon.tech"],
    ])("query parameters that could redirect the connection: %s", (_label, query) => {
      expect(() =>
        assertLocalDatabaseUrl("TEST_DATABASE_URL", `postgresql://u:${PW}@localhost:5432/ivo_test${query}`, "test"),
      ).toThrow(UnsafeDatabaseError);
    });
  });

  describe("rejects the wrong database, even on localhost", () => {
    it.each([
      ["neondb", "test"],
      ["postgres", "test"],
      ["ivo_dev", "test"],
      ["ivo_test", "dev"],
      ["ivo_test_backup", "test"],
      ["IVO_TEST", "test"],
      ["ivo_test/extra", "test"],
    ] as const)("database %s when the role is %s", (name, role) => {
      expect(() =>
        assertLocalDatabaseUrl("DATABASE_URL", `postgresql://postgres:${PW}@localhost:5432/${name}`, role),
      ).toThrow(UnsafeDatabaseError);
    });

    it("a URL with no database name", () => {
      expect(() => assertLocalDatabaseUrl("DATABASE_URL", `postgresql://postgres:${PW}@localhost:5432`, "test")).toThrow(
        UnsafeDatabaseError,
      );
      expect(() => assertLocalDatabaseUrl("DATABASE_URL", `postgresql://postgres:${PW}@localhost:5432/`, "test")).toThrow(
        UnsafeDatabaseError,
      );
    });
  });

  describe("rejects malformed values", () => {
    it.each([
      ["undefined", undefined],
      ["an empty string", ""],
      ["only whitespace", "   "],
      ["a non-postgres scheme", `mysql://postgres:${PW}@localhost:3306/ivo_test`],
      ["an http URL", "http://localhost/ivo_test"],
      ["not a URL at all", "localhost ivo_test"],
      ["the same URL pasted twice", `postgresql://postgres:${PW}@localhost/ivo_testpostgresql://postgres:${PW}@localhost/ivo_test`],
    ])("%s", (_label, value) => {
      expect(() => assertLocalDatabaseUrl("TEST_DATABASE_URL", value, "test")).toThrow(UnsafeDatabaseError);
    });
  });

  it("never puts the password, or the whole URL, in an error message", () => {
    const url = `postgresql://u:${PW}@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require`;
    let message = "";
    try {
      assertLocalDatabaseUrl("TEST_DATABASE_URL", url, "test");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(PW);
    expect(message).not.toContain("postgresql://");
    expect(message).not.toContain("neon.tech");
    expect(message).toContain("TEST_DATABASE_URL");
  });
});

describe("assertConnectedToLocal: what the live connection actually reports", () => {
  it.each([
    ["127.0.0.1"],
    ["::1"],
    [null], // a Unix socket has no network address
  ])("accepts ivo_test reached through %s", (serverAddress) => {
    expect(() => assertConnectedToLocal({ database: "ivo_test", serverAddress }, "test")).not.toThrow();
  });

  it("accepts ivo_dev for the dev role", () => {
    expect(() => assertConnectedToLocal({ database: "ivo_dev", serverAddress: "127.0.0.1" }, "dev")).not.toThrow();
  });

  it.each([["203.0.113.5"], ["10.1.2.3"], ["18.196.10.20"], ["192.168.1.10"]])(
    "rejects a server that is not loopback (%s), even if the database name is right",
    (serverAddress) => {
      expect(() => assertConnectedToLocal({ database: "ivo_test", serverAddress }, "test")).toThrow(UnsafeDatabaseError);
    },
  );

  it.each([
    ["neondb", "test"],
    ["ivo_dev", "test"],
    ["ivo_test", "dev"],
    ["postgres", "dev"],
  ] as const)("rejects database %s for the %s role", (database, role) => {
    expect(() => assertConnectedToLocal({ database, serverAddress: "127.0.0.1" }, role)).toThrow(UnsafeDatabaseError);
  });
});

describe("verifyLocalConnection: asks the database itself, and fails closed", () => {
  /** A stand-in for the Prisma client: only the tagged-template raw query is used. */
  const clientReturning = (rows: unknown[] | Error) => ({
    $queryRaw: async () => {
      if (rows instanceof Error) throw rows;
      return rows;
    },
  });

  it("passes when the server reports the expected local database", async () => {
    await expect(
      verifyLocalConnection(clientReturning([{ database: "ivo_test", addr: "127.0.0.1" }]), "test"),
    ).resolves.toBeUndefined();
  });

  it("refuses when a hostname resolved somewhere else: right name, remote address", async () => {
    await expect(
      verifyLocalConnection(clientReturning([{ database: "ivo_test", addr: "18.196.10.20" }]), "test"),
    ).rejects.toBeInstanceOf(UnsafeDatabaseError);
  });

  it("refuses the wrong database", async () => {
    await expect(
      verifyLocalConnection(clientReturning([{ database: "neondb", addr: "127.0.0.1" }]), "test"),
    ).rejects.toBeInstanceOf(UnsafeDatabaseError);
  });

  it("refuses when the server answers with nothing", async () => {
    await expect(verifyLocalConnection(clientReturning([]), "test")).rejects.toBeInstanceOf(UnsafeDatabaseError);
  });

  it("refuses when the check itself fails, instead of assuming it is safe", async () => {
    await expect(verifyLocalConnection(clientReturning(new Error("connection refused")), "test")).rejects.toBeInstanceOf(
      UnsafeDatabaseError,
    );
  });
});
