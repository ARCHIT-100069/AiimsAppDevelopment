import { defineConfig } from "vitest/config";

/**
 * Default (unit) test run. The isolation gate is deliberately excluded here —
 * it requires a real Postgres and runs via `test:isolation`
 * (vitest.isolation.config.ts) as its own blocking CI job (TDR-0006/0012).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
