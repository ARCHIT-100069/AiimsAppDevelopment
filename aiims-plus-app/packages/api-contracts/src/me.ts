/**
 * Patient-portal ("me") contracts. A patient reads ONLY their own record; the
 * summary aggregates their profile, appointments, diagnoses, and invoices.
 * Read-only — no write contracts here.
 */
import { z } from "zod";

export const myProfileSchema = z.object({
  id: z.uuid(),
  mrn: z.string(),
  nameGiven: z.string(),
  nameFamily: z.string(),
  gender: z.string(),
  birthDate: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  abhaAddress: z.string().nullable(),
});

export const myAppointmentSchema = z.object({
  id: z.uuid(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.string(),
  appointmentType: z.string(),
  reasonText: z.string().nullable(),
});

export const myDiagnosisSchema = z.object({
  code: z.string(),
  system: z.string(),
  display: z.string(),
  category: z.string(),
  clinicalStatus: z.string(),
  recordedAt: z.string(),
});

export const myInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  status: z.string(),
  currency: z.string(),
  total: z.string(),
  paymentMethod: z.string().nullable(),
  issuedAt: z.string(),
  paidAt: z.string().nullable(),
});

export const myVisitSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  chiefComplaint: z.string().nullable(),
  date: z.string(),
  signed: z.boolean(),
});

export const myReportLineSchema = z.object({
  analyte: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  referenceRange: z.string().nullable(),
  flag: z.enum(["normal", "high", "low", "critical"]),
});

export const myReportSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  conclusion: z.string(),
  issuedAt: z.string(),
  category: z.enum(["lab", "imaging", "other"]),
  /** Null until the ordering clinician reviews it (ADR-0022). Always
   *  non-null in the patient's own view (unreviewed reports never reach it);
   *  meaningful as a "pending review" signal in the staff-facing chart. */
  reviewedAt: z.string().nullable(),
  lines: z.array(myReportLineSchema),
});

export const myVitalSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  display: z.string(),
  valueNumeric: z.string().nullable(),
  unit: z.string().nullable(),
  valueText: z.string().nullable(),
  effectiveAt: z.string(),
});

export const myMedicationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  dose: z.string(),
  frequency: z.string(),
  duration: z.string(),
  status: z.string(),
  prescribedAt: z.string(),
});

export const mySummaryResponseSchema = z.object({
  profile: myProfileSchema,
  appointments: z.array(myAppointmentSchema),
  diagnoses: z.array(myDiagnosisSchema),
  invoices: z.array(myInvoiceSchema),
  visits: z.array(myVisitSchema),
  reports: z.array(myReportSchema),
  vitals: z.array(myVitalSchema),
  medications: z.array(myMedicationSchema),
});

/** Bookable practitioner option shown to the patient. */
export const bookablePractitionerSchema = z.object({
  practitionerId: z.uuid(),
  name: z.string(),
  specialty: z.string().nullable(),
  facilityId: z.uuid(),
  facilityName: z.string(),
  departmentId: z.uuid(),
  departmentName: z.string(),
});
export const bookableOptionsResponseSchema = z.object({
  practitioners: z.array(bookablePractitionerSchema),
});

/** A patient books an appointment for THEMSELVES — no patientId here; the
 *  server uses the token's own patient id. */
export const bookMyAppointmentRequestSchema = z.object({
  practitionerId: z.uuid(),
  facilityId: z.uuid(),
  departmentId: z.uuid().optional(),
  startAt: z.iso.datetime({ offset: true }),
  reasonText: z.string().trim().min(1).max(500).optional(),
});

/** Live OPD token — the patient's position in today's queue once checked in. */
export const myQueuePositionSchema = z.object({
  active: z.boolean(),
  token: z.number().int().nullable(),
  ahead: z.number().int().nullable(),
  total: z.number().int().nullable(),
  status: z.string().nullable(),
  practitionerName: z.string().nullable(),
});
export type MyQueuePosition = z.infer<typeof myQueuePositionSchema>;

export type MyProfile = z.infer<typeof myProfileSchema>;
export type MyAppointment = z.infer<typeof myAppointmentSchema>;
export type MyDiagnosis = z.infer<typeof myDiagnosisSchema>;
export type MyInvoice = z.infer<typeof myInvoiceSchema>;
export type MyVisit = z.infer<typeof myVisitSchema>;
export type MyReport = z.infer<typeof myReportSchema>;
export type MyVital = z.infer<typeof myVitalSchema>;
export type MyMedication = z.infer<typeof myMedicationSchema>;
export type MySummaryResponse = z.infer<typeof mySummaryResponseSchema>;
export type BookablePractitioner = z.infer<typeof bookablePractitionerSchema>;
export type BookableOptionsResponse = z.infer<typeof bookableOptionsResponseSchema>;
export type BookMyAppointmentRequest = z.infer<typeof bookMyAppointmentRequestSchema>;
