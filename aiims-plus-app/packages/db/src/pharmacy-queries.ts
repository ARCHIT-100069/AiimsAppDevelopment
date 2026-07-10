/**
 * Pharmacy data-access helpers (drug master, batched stock, prescriptions,
 * dispensing). Drizzle stays confined here (ADR-0011). Every helper requires a
 * tenant-scoped transaction (DDR-0002). Dispensing draws stock down FEFO
 * (earliest expiry first) inside the caller's unit of work.
 */
import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

const notDeleted = isNull(s.drug.deletedAt);

/* --------------------------------- drugs ---------------------------------- */
export interface DrugRow {
  id: string;
  name: string;
  form: string;
  strength: string;
  unit: string;
  category: string | null;
  reorderLevel: number;
  version: number;
}
const drugCols = {
  id: s.drug.id,
  name: s.drug.name,
  form: s.drug.form,
  strength: s.drug.strength,
  unit: s.drug.unit,
  category: s.drug.category,
  reorderLevel: s.drug.reorderLevel,
  version: s.drug.version,
};

export interface InsertDrugInput {
  id: string;
  tenantId: string;
  name: string;
  form: string;
  strength: string;
  unit?: string;
  category?: string | null;
  reorderLevel?: number;
}
export async function insertDrug(db: TenantDb, input: InsertDrugInput): Promise<DrugRow> {
  const [row] = await db
    .insert(s.drug)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      form: input.form,
      strength: input.strength,
      unit: input.unit ?? "unit",
      category: input.category ?? null,
      reorderLevel: input.reorderLevel ?? 0,
    })
    .returning(drugCols);
  if (!row) throw new Error("drug insert returned no row");
  return row;
}

export async function getDrugById(db: TenantDb, id: string): Promise<DrugRow | undefined> {
  const [row] = await db
    .select(drugCols)
    .from(s.drug)
    .where(and(eq(s.drug.id, id), notDeleted))
    .limit(1);
  return row;
}

export interface DrugStockRow extends DrugRow {
  totalQty: number;
}
/** Drug master with total on-hand quantity across batches. */
export async function listDrugStock(db: TenantDb): Promise<DrugStockRow[]> {
  const rows = await db
    .select({
      ...drugCols,
      totalQty: sql<number>`coalesce(sum(${s.stockBatch.quantity}), 0)::int`,
    })
    .from(s.drug)
    .leftJoin(
      s.stockBatch,
      and(eq(s.stockBatch.tenantId, s.drug.tenantId), eq(s.stockBatch.drugId, s.drug.id)),
    )
    .where(notDeleted)
    .groupBy(
      s.drug.id,
      s.drug.name,
      s.drug.form,
      s.drug.strength,
      s.drug.unit,
      s.drug.category,
      s.drug.reorderLevel,
      s.drug.version,
    )
    .orderBy(asc(s.drug.name));
  return rows;
}

/* --------------------------------- stock ---------------------------------- */
export interface InsertStockInput {
  id: string;
  tenantId: string;
  drugId: string;
  batchNo: string;
  expiryDate: string; // ISO date (yyyy-mm-dd)
  quantity: number;
  mrp?: string;
}
export async function insertStockBatch(db: TenantDb, input: InsertStockInput): Promise<void> {
  await db.insert(s.stockBatch).values({
    id: input.id,
    tenantId: input.tenantId,
    drugId: input.drugId,
    batchNo: input.batchNo,
    expiryDate: input.expiryDate,
    quantity: input.quantity,
    mrp: input.mrp ?? "0",
  });
}

export interface BatchRow {
  id: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
}
/** In-stock batches for a drug, earliest expiry first (FEFO). */
export async function batchesForDrugFefo(db: TenantDb, drugId: string): Promise<BatchRow[]> {
  return db
    .select({
      id: s.stockBatch.id,
      batchNo: s.stockBatch.batchNo,
      expiryDate: s.stockBatch.expiryDate,
      quantity: s.stockBatch.quantity,
    })
    .from(s.stockBatch)
    .where(and(eq(s.stockBatch.drugId, drugId), gt(s.stockBatch.quantity, 0)))
    .orderBy(asc(s.stockBatch.expiryDate));
}

export async function decrementBatch(db: TenantDb, batchId: string, qty: number): Promise<void> {
  await db
    .update(s.stockBatch)
    .set({ quantity: sql`${s.stockBatch.quantity} - ${qty}`, updatedAt: new Date() })
    .where(eq(s.stockBatch.id, batchId));
}

/* ----------------------------- prescriptions ------------------------------ */
export interface PrescriptionRow {
  id: string;
  patientId: string;
  encounterId: string | null;
  prescriberId: string;
  status: "active" | "dispensed" | "cancelled";
  note: string | null;
  version: number;
  createdAt: Date;
}
const prescCols = {
  id: s.prescription.id,
  patientId: s.prescription.patientId,
  encounterId: s.prescription.encounterId,
  prescriberId: s.prescription.prescriberId,
  status: s.prescription.status,
  note: s.prescription.note,
  version: s.prescription.version,
  createdAt: s.prescription.createdAt,
};

export interface InsertPrescriptionInput {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string | null;
  prescriberId: string;
  note?: string | null;
}
export async function insertPrescription(
  db: TenantDb,
  input: InsertPrescriptionInput,
): Promise<PrescriptionRow> {
  const [row] = await db
    .insert(s.prescription)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      prescriberId: input.prescriberId,
      note: input.note ?? null,
    })
    .returning(prescCols);
  if (!row) throw new Error("prescription insert returned no row");
  return row;
}

export interface InsertPrescriptionItemInput {
  id: string;
  tenantId: string;
  prescriptionId: string;
  drugId: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string | null;
}
export async function insertPrescriptionItem(
  db: TenantDb,
  input: InsertPrescriptionItemInput,
): Promise<void> {
  await db.insert(s.prescriptionItem).values({
    id: input.id,
    tenantId: input.tenantId,
    prescriptionId: input.prescriptionId,
    drugId: input.drugId,
    dose: input.dose,
    frequency: input.frequency,
    duration: input.duration,
    quantity: input.quantity,
    instructions: input.instructions ?? null,
  });
}

export interface PrescriptionItemRow {
  id: string;
  drugId: string;
  drugName: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string | null;
}
export async function listPrescriptionItems(
  db: TenantDb,
  prescriptionId: string,
): Promise<PrescriptionItemRow[]> {
  return db
    .select({
      id: s.prescriptionItem.id,
      drugId: s.prescriptionItem.drugId,
      drugName: s.drug.name,
      strength: s.drug.strength,
      form: s.drug.form,
      dose: s.prescriptionItem.dose,
      frequency: s.prescriptionItem.frequency,
      duration: s.prescriptionItem.duration,
      quantity: s.prescriptionItem.quantity,
      instructions: s.prescriptionItem.instructions,
    })
    .from(s.prescriptionItem)
    .innerJoin(
      s.drug,
      and(
        eq(s.drug.tenantId, s.prescriptionItem.tenantId),
        eq(s.drug.id, s.prescriptionItem.drugId),
      ),
    )
    .where(eq(s.prescriptionItem.prescriptionId, prescriptionId));
}

export async function getPrescriptionById(
  db: TenantDb,
  id: string,
): Promise<PrescriptionRow | undefined> {
  const [row] = await db
    .select(prescCols)
    .from(s.prescription)
    .where(eq(s.prescription.id, id))
    .limit(1);
  return row;
}

export async function listPrescriptions(
  db: TenantDb,
  status?: "active" | "dispensed" | "cancelled",
): Promise<PrescriptionRow[]> {
  const conds = [isNull(s.prescription.deletedAt)];
  if (status) conds.push(eq(s.prescription.status, status));
  return db
    .select(prescCols)
    .from(s.prescription)
    .where(and(...conds))
    .orderBy(desc(s.prescription.createdAt))
    .limit(100);
}

export async function listPrescriptionsByPatient(
  db: TenantDb,
  patientId: string,
): Promise<PrescriptionRow[]> {
  return db
    .select(prescCols)
    .from(s.prescription)
    .where(and(eq(s.prescription.patientId, patientId), isNull(s.prescription.deletedAt)))
    .orderBy(desc(s.prescription.createdAt));
}

/** Optimistic-concurrency status transition (DDR-0009). Returns false on miss. */
export async function markPrescriptionStatus(
  db: TenantDb,
  id: string,
  version: number,
  status: "dispensed" | "cancelled",
): Promise<boolean> {
  const rows = await db
    .update(s.prescription)
    .set({ status, version: version + 1, updatedAt: new Date() })
    .where(and(eq(s.prescription.id, id), eq(s.prescription.version, version)))
    .returning({ id: s.prescription.id });
  return rows.length > 0;
}

/* -------------------------------- dispense -------------------------------- */
export async function insertDispense(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    prescriptionId: string;
    patientId: string;
    dispensedBy: string;
  },
): Promise<void> {
  await db.insert(s.dispense).values(input);
}
export async function insertDispenseItem(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    dispenseId: string;
    drugId: string;
    batchId: string;
    quantity: number;
  },
): Promise<void> {
  await db.insert(s.dispenseItem).values(input);
}
