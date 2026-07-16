/**
 * Laboratory data-access helpers. The lab worklist is a facility-wide view over
 * lab orders (orders.service_request) joined to the patient and to any filed
 * report, so lab staff see every pending sample and every resulted test in one
 * place. Structured analyte lines (orders.lab_result_line) hang off a report.
 * Drizzle stays confined here (ADR-0011); every helper needs a tenant-scoped
 * transaction (DDR-0002).
 */
import { and, desc, eq, sql } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface LabWorklistRow {
  orderId: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  code: string;
  codeSystem: string;
  display: string;
  priority: "routine" | "urgent" | "stat";
  orderStatus: "active" | "completed" | "revoked";
  orderedAt: Date;
  reportId: string | null;
  reportStatus: "preliminary" | "final" | null;
  conclusion: string | null;
  issuedAt: Date | null;
}

/**
 * Every lab order for a facility, newest first, with the patient name and the
 * filed report (if any). `reportId === null` ⇒ still pending (sample/result
 * outstanding); non-null ⇒ resulted. Facility scoping comes from the order's
 * encounter.
 */
export async function listLabWorklist(db: TenantDb, facilityId: string): Promise<LabWorklistRow[]> {
  return db
    .select({
      orderId: s.serviceRequest.id,
      encounterId: s.serviceRequest.encounterId,
      patientId: s.serviceRequest.patientId,
      patientName: sql<string>`${s.patient.nameGiven} || ' ' || ${s.patient.nameFamily}`,
      code: s.serviceRequest.code,
      codeSystem: s.serviceRequest.codeSystem,
      display: s.serviceRequest.display,
      priority: s.serviceRequest.priority,
      orderStatus: s.serviceRequest.status,
      orderedAt: s.serviceRequest.createdAt,
      reportId: s.diagnosticReport.id,
      reportStatus: s.diagnosticReport.status,
      conclusion: s.diagnosticReport.conclusion,
      issuedAt: s.diagnosticReport.issuedAt,
    })
    .from(s.serviceRequest)
    .innerJoin(
      s.encounter,
      and(
        eq(s.encounter.tenantId, s.serviceRequest.tenantId),
        eq(s.encounter.id, s.serviceRequest.encounterId),
      ),
    )
    .innerJoin(
      s.patient,
      and(
        eq(s.patient.tenantId, s.serviceRequest.tenantId),
        eq(s.patient.id, s.serviceRequest.patientId),
      ),
    )
    .leftJoin(
      s.diagnosticReport,
      and(
        eq(s.diagnosticReport.tenantId, s.serviceRequest.tenantId),
        eq(s.diagnosticReport.serviceRequestId, s.serviceRequest.id),
      ),
    )
    .where(eq(s.encounter.facilityId, facilityId))
    .orderBy(desc(s.serviceRequest.createdAt));
}

export interface LabResultLineInput {
  analyte: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  flag?: "normal" | "high" | "low" | "critical";
}
export interface LabResultLineRow extends LabResultLineInput {
  id: string;
  flag: "normal" | "high" | "low" | "critical";
}

export async function insertLabResultLines(
  db: TenantDb,
  tenantId: string,
  reportId: string,
  lines: LabResultLineInput[],
  newId: () => string,
): Promise<void> {
  if (lines.length === 0) return;
  await db.insert(s.labResultLine).values(
    lines.map((l) => ({
      id: newId(),
      tenantId,
      reportId,
      analyte: l.analyte,
      value: l.value,
      unit: l.unit ?? null,
      referenceRange: l.referenceRange ?? null,
      flag: l.flag ?? "normal",
    })),
  );
}

export async function listLabResultLines(
  db: TenantDb,
  reportId: string,
): Promise<LabResultLineRow[]> {
  const rows = await db
    .select({
      id: s.labResultLine.id,
      analyte: s.labResultLine.analyte,
      value: s.labResultLine.value,
      unit: s.labResultLine.unit,
      referenceRange: s.labResultLine.referenceRange,
      flag: s.labResultLine.flag,
    })
    .from(s.labResultLine)
    .where(eq(s.labResultLine.reportId, reportId))
    .orderBy(s.labResultLine.createdAt);
  return rows;
}

/** Close a lab order once its result is filed (status → completed, version++). */
export async function markServiceRequestCompleted(db: TenantDb, orderId: string): Promise<void> {
  await db
    .update(s.serviceRequest)
    .set({
      status: "completed",
      version: sql`${s.serviceRequest.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(s.serviceRequest.id, orderId));
}
