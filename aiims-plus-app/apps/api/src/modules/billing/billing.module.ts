import { Module } from "@nestjs/common";
import { BillingController } from "./api/billing.controller";
import { FhirInvoiceController } from "./api/fhir-invoice.controller";
import { BillingService } from "./application/billing.service";

/**
 * Billing module (Stage 6, Master Plan §16) — invoice an encounter, take (mock)
 * payment, and (mock) share the care context on consent. Completes the demoable
 * OPD golden path (Milestone B). Audited, tenant-scoped, FHIR-regenerable
 * (flag-gated read, default OFF). Money is integer-paise math → numeric strings.
 */
@Module({
  controllers: [BillingController, FhirInvoiceController],
  providers: [BillingService],
})
export class BillingModule {}
