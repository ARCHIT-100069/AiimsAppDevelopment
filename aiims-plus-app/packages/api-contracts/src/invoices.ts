/**
 * Billing contracts (Stage 6, Master Plan §16) — invoice an encounter and take
 * (mock) payment. Money is a fixed-2-decimal STRING (never a float, DB §4); the
 * server computes in integer paise and formats here. Charge capture derives
 * lines from the encounter (consultation + one per order).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { codingSchema } from "./coding";

/** Positive money amount, exactly 2 decimals (e.g. "500.00"). */
export const moneySchema = z.string().regex(/^\d+\.\d{2}$/, "amount with 2 decimals");

export const INVOICE_STATUSES = ["issued", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Generate an invoice from an encounter. Optional overrides keep it MVP-lean. */
export const generateInvoiceRequestSchema = z.object({
  /** Consultation fee; defaults server-side when omitted. */
  consultationFee: moneySchema.optional(),
});
export type GenerateInvoiceRequest = z.infer<typeof generateInvoiceRequestSchema>;

export const invoiceLineSchema = z.object({
  id: uuidSchema,
  description: z.string(),
  code: codingSchema.nullable(),
  quantity: z.number().int(),
  unitAmount: moneySchema,
  lineAmount: moneySchema,
});
export type InvoiceLine = z.infer<typeof invoiceLineSchema>;

export const invoiceResponseSchema = z.object({
  id: uuidSchema,
  invoiceNumber: z.string(),
  encounterId: uuidSchema,
  patientId: uuidSchema,
  status: z.enum(INVOICE_STATUSES),
  currency: z.string(),
  subtotal: moneySchema,
  total: moneySchema,
  paymentRef: z.string().nullable(),
  lines: z.array(invoiceLineSchema),
  issuedAt: isoTimestampSchema,
  paidAt: isoTimestampSchema.nullable(),
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;

export const listInvoicesResponseSchema = z.object({
  data: z.array(invoiceResponseSchema),
});
export type ListInvoicesResponse = z.infer<typeof listInvoicesResponseSchema>;

/** Settle an invoice via the (mock) payment gateway. Idempotency-Key required. */
export const payInvoiceRequestSchema = z.object({
  method: z.enum(["mock", "cash", "card", "upi"]).default("mock"),
});
export type PayInvoiceRequest = z.infer<typeof payInvoiceRequestSchema>;

/** Mock ABDM share-on-consent — closes the golden path (care context linked). */
export const shareEncounterRequestSchema = z.object({
  purpose: z.string().trim().min(1).max(64).default("care-management"),
  scope: z.array(z.string().min(1)).min(1).default(["Encounter", "DiagnosticReport"]),
});
export type ShareEncounterRequest = z.infer<typeof shareEncounterRequestSchema>;

export const shareEncounterResponseSchema = z.object({
  encounterId: uuidSchema,
  consentArtifactRef: z.string(),
  careContextRef: z.string(),
  sharedAt: isoTimestampSchema,
});
export type ShareEncounterResponse = z.infer<typeof shareEncounterResponseSchema>;
