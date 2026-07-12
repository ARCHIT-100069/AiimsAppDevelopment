/**
 * `feedback` schema — mirrors the reviewed SQL in ../migrations (0017/0018).
 * Patient satisfaction (NABH/quality). Append-only; composite FKs keep rows
 * tenant-scoped (DDR-0008). Security DDL (RLS/grants) lives in migrations.
 */
import { integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const feedback = pgSchema("feedback");

export const patientFeedback = feedback.table("patient_feedback", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  encounterId: uuid("encounter_id"),
  rating: integer("rating").notNull(),
  category: text("category"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});
