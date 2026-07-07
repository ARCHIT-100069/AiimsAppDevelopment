/**
 * `billing` schema (Stage 6) — mirrors the reviewed SQL in ../migrations.
 * Money is `numeric(12,2)` (never float, DB §4). Drizzle describes the tables;
 * security DDL lives in the migrations (DDR-0011).
 */
import { bigint, integer, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const billing = pgSchema("billing");

export const invoiceCounter = billing.table("invoice_counter", {
  tenantId: uuid("tenant_id").primaryKey(),
  lastValue: bigint("last_value", { mode: "number" }).notNull().default(0),
});

export const invoice = billing.table("invoice", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  status: text("status").$type<"issued" | "paid" | "cancelled">().notNull().default("issued"),
  currency: text("currency").notNull().default("INR"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentRef: text("payment_ref"),
  paymentMethod: text("payment_method"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const invoiceLine = billing.table("invoice_line", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  invoiceId: uuid("invoice_id").notNull(),
  description: text("description").notNull(),
  codeSystem: text("code_system"),
  code: text("code"),
  display: text("display"),
  quantity: integer("quantity").notNull().default(1),
  unitAmount: numeric("unit_amount", { precision: 12, scale: 2 }).notNull(),
  lineAmount: numeric("line_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
