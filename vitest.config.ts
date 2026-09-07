import { defineConfig } from "vitest/config";

/**
 * Default suite — unit tests only, no database. Run with `npm test`.
 * Integration tests (`*.integration.test.ts`) have their own config; see
 * `vitest.integration.config.ts` / `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules",
      ".next",
      "e2e",
      "**/*.integration.test.ts",
    ],
  },
});
