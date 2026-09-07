import "server-only";
import * as z from "zod";

/**
 * Configuration is via env vars only (ADR-0001). This module fails fast at boot
 * if a required variable is missing, so misconfiguration never surfaces as a
 * confusing runtime error deep in a request.
 */
const schema = z.object({
  // Neon: pooled URL for the app, direct URL for migrations.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Better Auth.
  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // Vercel Blob (curated listing photos). Optional until the store is created.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

// Integration-test database (Neon `test` branch). NOT consumed here — the app
// never reads it. `scripts/resolve-test-db-env.ts` maps it onto DATABASE_URL for
// the test process only, and throws if it is missing (no fallback). Listed here
// only so the full env surface lives in one file.
//   TEST_DATABASE_URL, TEST_DIRECT_URL  → see .env.test.example

const raw = {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
};

// `SKIP_ENV_VALIDATION=1` lets `next build` / CI typegen run without real secrets
// (e.g. building the Docker image). Runtime always has the real values validated.
export const env =
  process.env.SKIP_ENV_VALIDATION === "1"
    ? (raw as z.infer<typeof schema>)
    : schema.parse(raw);
