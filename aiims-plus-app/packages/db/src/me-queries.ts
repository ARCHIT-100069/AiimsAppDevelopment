/**
 * Patient-portal read helpers (self-service). Every query is filtered by the
 * patient's own id AND runs inside the patient's tenant RLS context, so a
 * patient can only ever read their own record. Read-only — the portal never
 * writes clinical or billing data.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface MyDiagnosisRow {
  id: string;
  encounterId: string;
  codeSystem: string;
  code: string;
  display: string;
  category: "diagnosis" | "problem";
  clinicalStatus: "active" | "resolved";
  recordedAt: Date;
}

/** The patient's diagnoses/problems (ICD-10/SNOMED), newest first. */
export async function listDiagnosesByPatient(
  db: TenantDb,
  patientId: string,
): Promise<MyDiagnosisRow[]> {
  return db
    .select({
      id: s.condition.id,
      encounterId: s.condition.encounterId,
      codeSystem: s.condition.codeSystem,
      code: s.condition.code,
      display: s.condition.display,
      category: s.condition.category,
      clinicalStatus: s.condition.clinicalStatus,
      recordedAt: s.condition.createdAt,
    })
    .from(s.condition)
    .where(and(eq(s.condition.patientId, patientId), isNull(s.condition.deletedAt)))
    .orderBy(desc(s.condition.createdAt));
}

export interface MyInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: "issued" | "paid" | "cancelled";
  currency: string;
  total: string;
  paymentMethod: string | null;
  issuedAt: Date;
  paidAt: Date | null;
}

/** The patient's invoices, newest first. */
export async function listInvoicesByPatient(
  db: TenantDb,
  patientId: string,
): Promise<MyInvoiceRow[]> {
  return db
    .select({
      id: s.invoice.id,
      invoiceNumber: s.invoice.invoiceNumber,
      status: s.invoice.status,
      currency: s.invoice.currency,
      total: s.invoice.total,
      paymentMethod: s.invoice.paymentMethod,
      issuedAt: s.invoice.issuedAt,
      paidAt: s.invoice.paidAt,
    })
    .from(s.invoice)
    .where(and(eq(s.invoice.patientId, patientId), isNull(s.invoice.deletedAt)))
    .orderBy(desc(s.invoice.issuedAt));
}
