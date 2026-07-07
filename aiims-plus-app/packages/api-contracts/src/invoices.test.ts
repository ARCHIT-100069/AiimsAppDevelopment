import { describe, expect, it } from "vitest";
import {
  generateInvoiceRequestSchema,
  moneySchema,
  payInvoiceRequestSchema,
  shareEncounterRequestSchema,
} from "./invoices";
import { buildFhirInvoice } from "./fhir-invoice";

describe("billing contracts (Stage 6)", () => {
  it("money is a 2-decimal string, never a float", () => {
    expect(moneySchema.safeParse("500.00").success).toBe(true);
    expect(moneySchema.safeParse("500").success).toBe(false);
    expect(moneySchema.safeParse("500.5").success).toBe(false);
    expect(moneySchema.safeParse("-1.00").success).toBe(false);
  });

  it("generate invoice accepts an optional consultation fee override", () => {
    expect(generateInvoiceRequestSchema.parse({}).consultationFee).toBeUndefined();
    expect(generateInvoiceRequestSchema.safeParse({ consultationFee: "300.00" }).success).toBe(
      true,
    );
  });

  it("pay defaults to the mock method; share defaults purpose + scope", () => {
    expect(payInvoiceRequestSchema.parse({}).method).toBe("mock");
    const share = shareEncounterRequestSchema.parse({});
    expect(share.purpose).toBe("care-management");
    expect(share.scope.length).toBeGreaterThan(0);
  });

  it("FHIR Invoice maps status + totals (paid → balanced)", () => {
    const fhir = buildFhirInvoice({
      id: "0197a000-0000-7000-8000-000000000001",
      status: "paid",
      patientId: "0197a000-0000-7000-8000-000000000002",
      currency: "INR",
      total: "700.00",
      lines: [{ description: "Consultation", lineAmount: "500.00" }],
    });
    expect(fhir.resourceType).toBe("Invoice");
    expect(fhir.status).toBe("balanced");
    expect(fhir.totalGross.value).toBe(700);
    expect(fhir.lineItem[0]?.priceComponent[0]?.amount.value).toBe(500);
  });
});
