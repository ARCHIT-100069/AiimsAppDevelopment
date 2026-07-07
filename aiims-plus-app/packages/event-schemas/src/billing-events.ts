/**
 * Billing domain events (Stage 6) — versioned outbox payloads (DDR-0007).
 * References and minimal fields only; never PHI or full amounts beyond totals
 * needed downstream (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const INVOICE_ISSUED_V1 = "invoice.issued.v1" as const;
export const invoiceIssuedV1PayloadSchema = z.object({
  invoiceId: uuidSchema,
  encounterId: uuidSchema,
});

export const INVOICE_PAID_V1 = "invoice.paid.v1" as const;
export const invoicePaidV1PayloadSchema = z.object({
  invoiceId: uuidSchema,
  version: z.number().int(),
});

/** Mock ABDM care-context share (closes the OPD golden path). */
export const ENCOUNTER_SHARED_V1 = "encounter.shared.v1" as const;
export const encounterSharedV1PayloadSchema = z.object({
  encounterId: uuidSchema,
  patientId: uuidSchema,
});

export const BILLING_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [INVOICE_ISSUED_V1]: invoiceIssuedV1PayloadSchema,
  [INVOICE_PAID_V1]: invoicePaidV1PayloadSchema,
  [ENCOUNTER_SHARED_V1]: encounterSharedV1PayloadSchema,
};
