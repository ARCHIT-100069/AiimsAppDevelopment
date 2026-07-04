import { defineConfig } from "vitest/config";

/** The isolation gate runs slow (real Postgres container) and MUST not be skipped. */
export default defineConfig({
  test: {
    include: ["test/isolation.spec.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    passWithNoTests: false,
  },
});
