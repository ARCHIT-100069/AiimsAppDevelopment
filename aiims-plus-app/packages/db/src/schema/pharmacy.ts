/**
 * `pharmacy` schema — mirrors the reviewed SQL in ../migrations (0015/0016).
 * Drizzle describes the tables; security DDL (RLS/grants) lives in migrations
 * (DDR-0011). Quantities are integers; money is numeric(12,2).
 */
import { date, integer, numeric, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const pharmacy = pgSchema("pharmacy");

export const drug = pharmacy.table("drug", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  form: text("form").notNull(),
  strength: text("strength").notNull(),
  unit: text("unit").notNull().default("unit"),
  category: text("category"),
  reorderLevel: integer("reorder_level").notNull().default(0),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const stockBatch = pharmacy.table("stock_batch", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  drugId: uuid("drug_id").notNull(),
  batchNo: text("batch_no").notNull(),
  expiryDate: date("expiry_date").notNull(),
  quantity: integer("quantity").notNull(),
  mrp: numeric("mrp", { precision: 12, scale: 2 }).notNull().default("0"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prescription = pharmacy.table("prescription", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  encounterId: uuid("encounter_id"),
  prescriberId: uuid("prescriber_id").notNull(),
  status: text("status").$type<"active" | "dispensed" | "cancelled">().notNull().default("active"),
  note: text("note"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const prescriptionItem = pharmacy.table("prescription_item", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  prescriptionId: uuid("prescription_id").notNull(),
  drugId: uuid("drug_id").notNull(),
  dose: text("dose").notNull(),
  frequency: text("frequency").notNull(),
  duration: text("duration").notNull(),
  quantity: integer("quantity").notNull(),
  instructions: text("instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dispense = pharmacy.table("dispense", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  prescriptionId: uuid("prescription_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  dispensedBy: uuid("dispensed_by").notNull(),
  dispensedAt: timestamp("dispensed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dispenseItem = pharmacy.table("dispense_item", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  dispenseId: uuid("dispense_id").notNull(),
  drugId: uuid("drug_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
