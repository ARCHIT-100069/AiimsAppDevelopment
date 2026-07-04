import { pgSchema, uuid, text, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";

// Bounded-context schema (DDR 0004). RLS applied via SQL migration (DDR 0002/0011), not drizzle-kit.
export const platform = pgSchema("platform");

// Isolation root — NOT tenant-RLS'd (it is the tenancy lookup itself).
export const tenant = platform.table("tenant", {
  id: uuid("id").primaryKey(),                 // app-generated UUIDv7 (DDR 0001)
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  isolationMode: text("isolation_mode").notNull().default("shared"), // shared | dedicated
  region: text("region").notNull().default("ap-south-1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tenant-scoped example entity to prove the walking skeleton (a trivial audited write).
export const note = platform.table("note", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),       // + RLS (migration)
  body: text("body").notNull(),
  createdBy: uuid("created_by"),
  version: integer("version").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ byTenant: index("ix_note__tenant").on(t.tenantId) }));

// Transactional outbox (DDR 0007) — tenant-scoped, RLS'd.
export const outbox = platform.table("outbox", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),      // versioned e.g. note.created.v1
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  dispatchAttempts: integer("dispatch_attempts").notNull().default(0),
}, (t) => ({ pending: index("ix_outbox__pending").on(t.dispatchedAt) }));

// Feature flags (ADR 0010) — null tenant = global default.
export const featureFlag = platform.table("feature_flag", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id"),
  key: text("key").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  variant: jsonb("variant"),
});
