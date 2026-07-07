/**
 * FHIR R4 Invoice mapper (ADR-0003/DDR-0005) — dark by default behind
 * `fhir.read`. A light, schema-valid projection of the billing invoice.
 */
import { z } from "zod";
import type { InvoiceStatus } from "./invoices";

export const fhirInvoiceSchema = z.object({
  resourceType: z.literal("Invoice"),
  id: z.string(),
  status: z.string(),
  subject: z.object({ reference: z.string() }),
  lineItem: z.array(
    z.object({
      chargeItemCodeableConcept: z.object({ text: z.string() }),
      priceComponent: z.array(
        z.object({
          type: z.string(),
          amount: z.object({ value: z.number(), currency: z.string() }),
        }),
      ),
    }),
  ),
  totalGross: z.object({ value: z.number(), currency: z.string() }),
});
export type FhirInvoice = z.infer<typeof fhirInvoiceSchema>;

const STATUS: Record<InvoiceStatus, string> = {
  issued: "issued",
  paid: "balanced",
  cancelled: "cancelled",
};

export interface FhirInvoiceInput {
  id: string;
  status: InvoiceStatus;
  patientId: string;
  currency: string;
  total: string;
  lines: { description: string; lineAmount: string }[];
}

export function buildFhirInvoice(input: FhirInvoiceInput): FhirInvoice {
  return fhirInvoiceSchema.parse({
    resourceType: "Invoice",
    id: input.id,
    status: STATUS[input.status],
    subject: { reference: `Patient/${input.patientId}` },
    lineItem: input.lines.map((l) => ({
      chargeItemCodeableConcept: { text: l.description },
      priceComponent: [
        { type: "base", amount: { value: Number(l.lineAmount), currency: input.currency } },
      ],
    })),
    totalGross: { value: Number(input.total), currency: input.currency },
  });
}
