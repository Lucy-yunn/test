import { defineConfig } from "vitest/config";

/**
 * Integration suite — hits the Neon `test` branch. Run with `npm run test:integration`.
 * The setup file refuses to run without `TEST_DATABASE_URL` (see .env.test.example).
 *
 * Timeouts are generous: every case does real round-trips to a remote database
 * plus scrypt password hashing (~300ms each), and Neon's compute cold-starts.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
    setupFiles: ["./vitest.integration.setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 45_000,
    // Migrations + shared rows: don't run integration files in parallel.
    fileParallelism: false,
  },
});
