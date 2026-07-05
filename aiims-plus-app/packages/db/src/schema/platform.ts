/**
 * `platform` schema — tenancy root, identity mapping, RBAC, flags, outbox
 * (DATABASE-ARCHITECTURE §5–§6). Column names/types mirror the reviewed SQL
 * in ../migrations exactly; Drizzle describes the tables for typed queries,
 * it does not own the security DDL (DDR-0011).
 */
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const platform = pgSchema("platform");

/** Isolation root — deliberately NOT tenant-RLS'd (DB Arch §5); admin-only writes. */
export const tenant = platform.table("tenant", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").$type<"active" | "suspended">().notNull().default("active"),
  isolationMode: text("isolation_mode").$type<"shared" | "dedicated">().notNull().default("shared"),
  region: text("region").notNull().default("ap-south-1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Keycloak subject → tenant user mapping (ADR-0008: no passwords stored here). */
export const appUser = platform.table("app_user", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  keycloakSub: text("keycloak_sub").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").$type<"active" | "disabled">().notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const role = platform.table("role", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRole = platform.table("user_role", {
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  roleId: uuid("role_id").notNull(),
  /** Optional department scoping (DB Arch §5); added in migration 0002. */
  departmentId: uuid("department_id"),
});

/* ------------------- Stage 1: org structure (DB Arch §5) ------------------ */

export const organization = platform.table("organization", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  type: text("type").$type<"hospital" | "clinic" | "chain">().notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const facility = platform.table("facility", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  address: jsonb("address"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const department = platform.table("department", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  facilityId: uuid("facility_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** NULL tenant_id = global default; a tenant row overrides it (DB Arch §5). */
export const featureFlag = platform.table("feature_flag", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id"),
  key: text("key").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  variant: jsonb("variant"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Transactional outbox (DDR-0007) — written in the SAME transaction as the
 * business change. Range-partitioned by month on occurred_at (DDR-0010);
 * the partition DDL is hand-written SQL.
 */
export const outbox = platform.table("outbox", {
  id: uuid("id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  dispatchAttempts: integer("dispatch_attempts").notNull().default(0),
});

/**
 * Idempotency-Key persistence (APDR-0006, decision S2-e): written in the SAME
 * transaction as the resource it protects; replay returns the original.
 */
export const idempotencyKey = platform.table("idempotency_key", {
  tenantId: uuid("tenant_id").notNull(),
  endpoint: text("endpoint").notNull(),
  key: text("key").notNull(),
  resourceId: uuid("resource_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Bookkeeping for the SQL migration runner (not managed by drizzle-kit). */
export const schemaMigrations = platform.table("schema_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
