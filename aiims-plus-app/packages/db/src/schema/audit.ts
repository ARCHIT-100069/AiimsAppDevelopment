/**
 * `audit` schema — append-only, hash-chained audit log (ADR-0005, DDR-0007).
 * INSERT-only for aiims_app (UPDATE/DELETE revoked in the reviewed SQL);
 * range-partitioned by month (DDR-0010). No PHI payloads — references only.
 */
import { bytea } from "./bytea";
import { jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const audit = pgSchema("audit");

export const auditLog = audit.table("audit_log", {
  /** Equals the outbox event id — makes audit projection idempotent (BDR-0005). */
  id: uuid("id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  actorId: uuid("actor_id").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  consentRef: uuid("consent_ref"),
  context: jsonb("context").notNull().default({}),
  prevHash: bytea("prev_hash").notNull(),
  rowHash: bytea("row_hash").notNull(),
});
