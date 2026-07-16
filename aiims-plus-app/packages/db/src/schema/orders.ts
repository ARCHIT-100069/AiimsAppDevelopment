/**
 * `orders` schema (Stage 5) — mirrors the reviewed SQL in ../migrations.
 * ServiceRequest (lab/imaging order) + DiagnosticReport (result). Drizzle
 * describes the tables; security DDL lives in the migrations (DDR-0011).
 */
import { integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const orders = pgSchema("orders");

export const serviceRequest = orders.table("service_request", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  codeSystem: text("code_system").notNull(),
  code: text("code").notNull(),
  display: text("display").notNull(),
  intent: text("intent").$type<"order">().notNull().default("order"),
  category: text("category").$type<"lab" | "imaging" | "other">().notNull().default("lab"),
  status: text("status").$type<"active" | "completed" | "revoked">().notNull().default("active"),
  priority: text("priority").$type<"routine" | "urgent" | "stat">().notNull().default("routine"),
  note: text("note"),
  requesterId: uuid("requester_id").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const diagnosticReport = orders.table("diagnostic_report", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  serviceRequestId: uuid("service_request_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  status: text("status").$type<"preliminary" | "final">().notNull().default("final"),
  conclusion: text("conclusion").notNull(),
  attachmentId: uuid("attachment_id"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  filedBy: uuid("filed_by").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Structured analyte lines on a lab report (0019_laboratory). Append-only. */
export const labResultLine = orders.table("lab_result_line", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  reportId: uuid("report_id").notNull(),
  analyte: text("analyte").notNull(),
  value: text("value").notNull(),
  unit: text("unit"),
  referenceRange: text("reference_range"),
  flag: text("flag").$type<"normal" | "high" | "low" | "critical">().notNull().default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
