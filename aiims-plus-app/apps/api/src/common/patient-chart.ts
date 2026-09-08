/**
 * Shared patient-chart composition — the same aggregate (profile, visits,
 * diagnoses, vitals, medications, reports, invoices) is used by the patient's
 * own portal summary (self:read, own record only) and the staff-facing chart
 * (patient:read, any authorized patient). One builder, two callers, so the
 * two views can never drift apart.
 */
import {
  getPatientById,
  listDiagnosesByPatient,
  listInvoicesByPatient,
  listLabResultLines,
  listPrescriptionItems,
  listPrescriptionsByPatient,
  listReportsByPatient,
  listVisitsByPatient,
  listVitalsByPatient,
  searchAppointments,
  type TenantDb,
} from "@aiims/db";
import type { MySummaryResponse } from "@aiims/api-contracts";

export async function buildPatientChart(
  db: TenantDb,
  patientId: string,
  /** true for the patient's own portal (ADR-0022: only reviewed reports);
   *  false for the staff-facing chart, which must show a result the moment
   *  it's filed — that's where the ordering clinician reviews it. */
  patientFacing: boolean,
): Promise<MySummaryResponse | null> {
  const patient = await getPatientById(db, patientId);
  if (!patient) return null;

  // Sequential, not Promise.all: every query below shares the one pg client
  // this transaction holds, and node-postgres only allows one in-flight
  // query per client — concurrent awaits on it are deprecated (pg#9 removes
  // support entirely) even though today's driver silently queues them.
  const appointments = await searchAppointments(db, { patientId, limit: 20 });
  const diagnoses = await listDiagnosesByPatient(db, patientId);
  const invoices = await listInvoicesByPatient(db, patientId);
  const visits = await listVisitsByPatient(db, patientId);
  const reportRows = await listReportsByPatient(db, patientId, patientFacing);
  const vitals = await listVitalsByPatient(db, patientId);
  const prescriptions = await listPrescriptionsByPatient(db, patientId);

  const medications = [];
  for (const p of prescriptions) {
    const items = await listPrescriptionItems(db, p.id);
    for (const it of items) {
      medications.push({
        id: it.id,
        name: `${it.drugName} ${it.strength}`,
        dose: it.dose,
        frequency: it.frequency,
        duration: it.duration,
        status: p.status,
        prescribedAt: p.createdAt.toISOString(),
      });
    }
  }

  return {
    profile: {
      id: patient.id,
      mrn: patient.mrn,
      nameGiven: patient.nameGiven,
      nameFamily: patient.nameFamily,
      gender: patient.gender,
      birthDate: patient.birthDate,
      // Encrypted identifiers stay out of this aggregate; the chart's own
      // profile section reads the full record separately when needed.
      phone: null,
      email: null,
      abhaAddress: patient.abhaAddress ?? null,
    },
    appointments: appointments.map((a) => ({
      id: a.id,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      appointmentType: a.appointmentType,
      reasonText: a.reasonText ?? null,
    })),
    diagnoses: diagnoses.map((d) => ({
      code: d.code,
      system: d.codeSystem,
      display: d.display,
      category: d.category,
      clinicalStatus: d.clinicalStatus,
      recordedAt: d.recordedAt.toISOString(),
    })),
    invoices: invoices.map((i) => ({
      invoiceNumber: i.invoiceNumber,
      status: i.status,
      currency: i.currency,
      total: i.total,
      paymentMethod: i.paymentMethod ?? null,
      issuedAt: i.issuedAt.toISOString(),
      paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    })),
    visits: visits.map((v) => ({
      id: v.id,
      status: v.status,
      chiefComplaint: v.chiefComplaint ?? null,
      date: v.periodStart.toISOString(),
      signed: v.signedAt !== null,
    })),
    reports: await (async () => {
      const out = [];
      for (const r of reportRows) {
        const lines = await listLabResultLines(db, r.id);
        out.push({
          id: r.id,
          status: r.status,
          conclusion: r.conclusion,
          issuedAt: r.issuedAt.toISOString(),
          category: r.category,
          reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
          lines: lines.map((l) => ({
            analyte: l.analyte,
            value: l.value,
            unit: l.unit ?? null,
            referenceRange: l.referenceRange ?? null,
            flag: l.flag,
          })),
        });
      }
      return out;
    })(),
    vitals: vitals.map((v) => ({
      id: v.id,
      code: v.code,
      display: v.display,
      valueNumeric: v.valueNumeric ?? null,
      unit: v.unit ?? null,
      valueText: v.valueText ?? null,
      effectiveAt: v.effectiveAt.toISOString(),
    })),
    medications,
  };
}
