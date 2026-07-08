import { defineConfig } from "vitest/config";

/** Integration suite (TDR-0003): real Postgres via Testcontainers. */
export default defineConfig({
  test: {
    include: [
      "test/platform.spec.ts",
      "test/patient.spec.ts",
      "test/practitioner.spec.ts",
      "test/scheduling.spec.ts",
      "test/emr.spec.ts",
      "test/billing.spec.ts",
    ],
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
