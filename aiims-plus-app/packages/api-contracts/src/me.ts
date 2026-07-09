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

export const mySummaryResponseSchema = z.object({
  profile: myProfileSchema,
  appointments: z.array(myAppointmentSchema),
  diagnoses: z.array(myDiagnosisSchema),
  invoices: z.array(myInvoiceSchema),
});

export type MyProfile = z.infer<typeof myProfileSchema>;
export type MyAppointment = z.infer<typeof myAppointmentSchema>;
export type MyDiagnosis = z.infer<typeof myDiagnosisSchema>;
export type MyInvoice = z.infer<typeof myInvoiceSchema>;
export type MySummaryResponse = z.infer<typeof mySummaryResponseSchema>;
