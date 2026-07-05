/**
 * `reference` schema — GLOBAL coded concepts (DDR-0012): non-tenant, seeded,
 * read-only to aiims_app, versioned by release.
 */
import { boolean, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const reference = pgSchema("reference");

export const codeSystem = reference.table("code_system", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  release: text("release").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referenceCode = reference.table("code", {
  system: text("system").notNull(),
  code: text("code").notNull(),
  display: text("display").notNull(),
  active: boolean("active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
