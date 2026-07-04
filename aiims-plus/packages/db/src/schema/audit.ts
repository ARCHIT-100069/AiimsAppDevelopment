import { pgSchema, uuid, text, timestamp, jsonb, customType } from "drizzle-orm/pg-core";

// Append-only, hash-chained audit (DDR 0007 / SDR-0007). No PHI payloads.
export const audit = pgSchema("audit");
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const auditLog = audit.table("audit_log", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  consentRef: uuid("consent_ref"),
  context: jsonb("context").notNull().default({}), // source/request-id/outcome — NO PHI
  prevHash: bytea("prev_hash"),
  rowHash: bytea("row_hash").notNull(),
});
