import { describe, it, expect } from "vitest";
import { seedDatabase } from "./seed";
import { UnsafeDatabaseError } from "../../scripts/local-db-guard";
import type { PrismaClient } from "@prisma/client";

/**
 * The seed wipes every table before it inserts. It must first ask the live connection
 * which database it is talking to, and touch NOTHING if the answer is not the local
 * database for its role. This stand-in records every table the seed reaches for.
 */
function fakeClient(answer: unknown[] | Error) {
  const touched: string[] = [];
  const client = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "$queryRaw") {
          return async () => {
            if (answer instanceof Error) throw answer;
            return answer;
          };
        }
        touched.push(String(prop));
        return new Proxy({}, { get: () => async () => undefined });
      },
    },
  ) as unknown as PrismaClient;
  return { client, touched };
}

describe("seedDatabase refuses to wipe anything but the local database for its role", () => {
  it("refuses a database that is not ivo_dev, and touches no table", async () => {
    const { client, touched } = fakeClient([{ database: "neondb", addr: "18.196.10.20" }]);
    await expect(seedDatabase(client, { role: "dev" })).rejects.toBeInstanceOf(UnsafeDatabaseError);
    expect(touched).toEqual([]);
  });

  it("refuses the right name on a server that is not on this machine", async () => {
    const { client, touched } = fakeClient([{ database: "ivo_dev", addr: "18.196.10.20" }]);
    await expect(seedDatabase(client, { role: "dev" })).rejects.toBeInstanceOf(UnsafeDatabaseError);
    expect(touched).toEqual([]);
  });

  it("refuses ivo_test when the dev seed is running, and ivo_dev when the test seed is", async () => {
    const test = fakeClient([{ database: "ivo_test", addr: "127.0.0.1" }]);
    await expect(seedDatabase(test.client, { role: "dev" })).rejects.toBeInstanceOf(UnsafeDatabaseError);
    expect(test.touched).toEqual([]);

    const dev = fakeClient([{ database: "ivo_dev", addr: "127.0.0.1" }]);
    await expect(seedDatabase(dev.client, { role: "test" })).rejects.toBeInstanceOf(UnsafeDatabaseError);
    expect(dev.touched).toEqual([]);
  });

  it("refuses when it cannot tell which database it is connected to", async () => {
    const { client, touched } = fakeClient(new Error("connection refused"));
    await expect(seedDatabase(client, { role: "dev" })).rejects.toBeInstanceOf(UnsafeDatabaseError);
    expect(touched).toEqual([]);
  });
});
