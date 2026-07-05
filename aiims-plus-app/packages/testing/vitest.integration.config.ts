import { defineConfig } from "vitest/config";

/** Stage 1 integration suite (TDR-0003): real Postgres via Testcontainers. */
export default defineConfig({
  test: {
    include: ["test/platform.spec.ts", "test/patient.spec.ts"],
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
