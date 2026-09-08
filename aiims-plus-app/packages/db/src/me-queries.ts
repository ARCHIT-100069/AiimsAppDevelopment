/**
 * Patient-portal read helpers (self-service). Every query is filtered by the
 * patient's own id AND runs inside the patient's tenant RLS context, so a
 * patient can only ever read their own record. Read-only — the portal never
 * writes clinical or billing data.
 */
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface BookablePractitionerRow {
  practitionerId: string;
  name: string;
  specialty: string | null;
  facilityId: string;
  facilityName: string;
  departmentId: string;
  departmentName: string;
}

/** Practitioners a patient can book with: active, with a department + facility,
 *  and — critically — whose linked login actually holds the "doctor" role.
 *  A practitioner profile alone isn't enough: nurses get one too (so they're
 *  attributable on documentation), but a patient booking an OPD consultation
 *  must never be offered a nurse in the same list as a physician. */
export async function listBookablePractitioners(db: TenantDb): Promise<BookablePractitionerRow[]> {
  return db
    .select({
      practitionerId: s.practitioner.id,
      nameGiven: s.practitioner.nameGiven,
      nameFamily: s.practitioner.nameFamily,
      specialty: s.practitioner.specialtyDisplay,
      facilityId: s.facility.id,
      facilityName: s.facility.name,
      departmentId: s.department.id,
      departmentName: s.department.name,
    })
    .from(s.practitioner)
    .innerJoin(s.department, eq(s.department.id, s.practitioner.departmentId))
    .innerJoin(s.facility, eq(s.facility.id, s.department.facilityId))
    .innerJoin(s.userRole, eq(s.userRole.userId, s.practitioner.appUserId))
    .innerJoin(s.role, and(eq(s.role.id, s.userRole.roleId), eq(s.role.code, "doctor")))
    .where(and(eq(s.practitioner.status, "active"), isNull(s.practitioner.deletedAt)))
    .orderBy(s.practitioner.nameFamily)
    .then((rows) =>
      rows.map((r) => ({
        practitionerId: r.practitionerId,
        name: `${r.nameGiven} ${r.nameFamily}`.trim(),
        specialty: r.specialty,
        facilityId: r.facilityId,
        facilityName: r.facilityName,
        departmentId: r.departmentId,
        departmentName: r.departmentName,
      })),
    );
}

export interface MyVisitRow {
  id: string;
  status: string;
  chiefComplaint: string | null;
  periodStart: Date;
  signedAt: Date | null;
}

/** The patient's past/current visits (encounters), newest first. */
export async function listVisitsByPatient(db: TenantDb, patientId: string): Promise<MyVisitRow[]> {
  return db
    .select({
      id: s.encounter.id,
      status: s.encounter.status,
      chiefComplaint: s.encounter.chiefComplaint,
      periodStart: s.encounter.periodStart,
      signedAt: s.encounter.signedAt,
    })
    .from(s.encounter)
    .where(and(eq(s.encounter.patientId, patientId), isNull(s.encounter.deletedAt)))
    .orderBy(desc(s.encounter.periodStart));
}

export interface MyVitalRow {
  id: string;
  code: string;
  display: string;
  valueNumeric: string | null;
  unit: string | null;
  valueText: string | null;
  effectiveAt: Date;
}

/** The patient's vitals/observations (LOINC), newest first. */
export async function listVitalsByPatient(db: TenantDb, patientId: string): Promise<MyVitalRow[]> {
  return db
    .select({
      id: s.observation.id,
      code: s.observation.code,
      display: s.observation.display,
      valueNumeric: s.observation.valueNumeric,
      unit: s.observation.unit,
      valueText: s.observation.valueText,
      effectiveAt: s.observation.effectiveAt,
    })
    .from(s.observation)
    .where(and(eq(s.observation.patientId, patientId), isNull(s.observation.deletedAt)))
    .orderBy(desc(s.observation.effectiveAt));
}

export interface MyReportRow {
  id: string;
  status: "preliminary" | "final";
  conclusion: string;
  issuedAt: Date;
  category: "lab" | "imaging" | "other";
  reviewedAt: Date | null;
}

/** The patient's diagnostic reports (lab/imaging), newest first.
 *
 *  `reviewedOnly` is the ADR-0022 gate: a result exists the moment the lab
 *  files it, but it isn't the PATIENT's to see until the ordering clinician
 *  has reviewed it. The patient's own portal (`/v1/me/summary`) must always
 *  pass `true`. Staff viewing the same aggregate for a patient chart
 *  (`/v1/patients/:id/chart`) pass `false` — a doctor needs to see (and
 *  review) a result the moment it's filed, not after they've already
 *  reviewed it. */
export async function listReportsByPatient(
  db: TenantDb,
  patientId: string,
  reviewedOnly: boolean,
): Promise<MyReportRow[]> {
  return db
    .select({
      id: s.diagnosticReport.id,
      status: s.diagnosticReport.status,
      conclusion: s.diagnosticReport.conclusion,
      issuedAt: s.diagnosticReport.issuedAt,
      category: s.serviceRequest.category,
      reviewedAt: s.diagnosticReport.reviewedAt,
    })
    .from(s.diagnosticReport)
    .innerJoin(
      s.serviceRequest,
      and(
        eq(s.serviceRequest.tenantId, s.diagnosticReport.tenantId),
        eq(s.serviceRequest.id, s.diagnosticReport.serviceRequestId),
      ),
    )
    .where(
      and(
        eq(s.diagnosticReport.patientId, patientId),
        isNull(s.diagnosticReport.deletedAt),
        reviewedOnly ? isNotNull(s.diagnosticReport.reviewedAt) : undefined,
      ),
    )
    .orderBy(desc(s.diagnosticReport.issuedAt));
}

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
