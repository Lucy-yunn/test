import { describe, it, expect } from "vitest";
import { runGuarded, type GuardedRunDeps } from "./guarded-run";

const LOCAL_TEST = "postgresql://postgres:pw@localhost:5432/ivo_test";

/** Stand-ins for the database client and the process spawner, recording what happened. */
function deps(answer: unknown[] | Error, spawnStatus = 0) {
  const log: string[] = [];
  const d: GuardedRunDeps = {
    makeClient: (url) => {
      log.push(`client:${url === LOCAL_TEST ? "local-url" : "other-url"}`);
      return {
        $queryRaw: (async () => {
          log.push("probe");
          if (answer instanceof Error) throw answer;
          return answer;
        }) as never,
        $disconnect: async () => {
          log.push("disconnect");
        },
      };
    },
    spawn: (command, args) => {
      log.push(`spawn:${command} ${args.join(" ")}`);
      return spawnStatus;
    },
    report: (line) => log.push(`report:${line}`),
  };
  return { d, log };
}

const base = { role: "test" as const, env: { DATABASE_URL: LOCAL_TEST, DIRECT_URL: LOCAL_TEST }, command: "prisma", args: ["migrate", "deploy"] };

describe("runGuarded: the command only runs after the live database has been checked", () => {
  it("asks the database first, then runs the command, then disconnects", async () => {
    const { d, log } = deps([{ database: "ivo_test", addr: "127.0.0.1" }]);
    expect(await runGuarded(base, d)).toBe(0);
    expect(log).toEqual(["client:local-url", "probe", "disconnect", "spawn:prisma migrate deploy"]);
  });

  it("never runs the command when the server is not the local ivo_test", async () => {
    for (const answer of [
      [{ database: "neondb", addr: "18.196.10.20" }],
      [{ database: "ivo_test", addr: "18.196.10.20" }],
      [{ database: "ivo_dev", addr: "127.0.0.1" }],
      [],
      new Error("timeout"),
    ]) {
      const { d, log } = deps(answer);
      expect(await runGuarded(base, d)).toBe(1);
      expect(log.some((l) => l.startsWith("spawn:"))).toBe(false);
      expect(log).toContain("disconnect");
      expect(log.some((l) => l.startsWith("report:"))).toBe(true);
    }
  });

  it("passes the command's own exit code back", async () => {
    const { d } = deps([{ database: "ivo_test", addr: "127.0.0.1" }], 3);
    expect(await runGuarded(base, d)).toBe(3);
  });

  it("checks the URL before it opens any connection", async () => {
    const { d, log } = deps([{ database: "ivo_test", addr: "127.0.0.1" }]);
    const remote = { ...base, env: { DATABASE_URL: "postgresql://u:pw@ep-x.eu-central-1.aws.neon.tech/neondb", DIRECT_URL: "" } };
    expect(await runGuarded(remote, d)).toBe(1);
    expect(log.some((l) => l.startsWith("client:"))).toBe(false);
    expect(log.some((l) => l.startsWith("spawn:"))).toBe(false);
  });

  it("does not print the password or the connection string when it refuses", async () => {
    const { d, log } = deps([{ database: "neondb", addr: "18.196.10.20" }]);
    await runGuarded({ ...base, env: { DATABASE_URL: "postgresql://postgres:hunter2-secret@localhost:5432/ivo_test", DIRECT_URL: "" } }, d);
    expect(log.join("\n")).not.toContain("hunter2-secret");
    expect(log.join("\n")).not.toContain("postgresql://");
  });
});
