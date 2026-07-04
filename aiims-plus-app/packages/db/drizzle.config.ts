/**
 * drizzle-kit configuration (DDR-0011).
 *
 * drizzle-kit may generate PURE TABLE/COLUMN migrations only. It is never
 * used for — and must never manage — roles, GRANT/REVOKE, RLS policies,
 * FORCE ROW LEVEL SECURITY, or partitions: those are hand-written, reviewed
 * SQL in src/migrations/ (the guardrail against the silent policy-drop
 * footgun). `entities.roles: false` keeps role management off.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  entities: {
    roles: false,
  },
});
