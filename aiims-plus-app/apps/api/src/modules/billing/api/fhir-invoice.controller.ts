/**
 * FHIR R4 Invoice read (Stage 6) — dark by default behind `fhir.read`.
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { buildFhirInvoice, type FhirInvoice } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { BillingService } from "../application/billing.service";

@Controller("fhir/R4/Invoice")
export class FhirInvoiceController {
  constructor(
    private readonly billing: BillingService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get(":id")
  @RequirePermission("billing:read")
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirInvoice> {
    if (!(await this.flags.isEnabled("fhir.read", principal.tenantId))) {
      throw new NotFoundError("Not found"); // dark by default
    }
    const { invoice, lines } = await this.billing.getById(principal, id);
    return buildFhirInvoice({
      id: invoice.id,
      status: invoice.status,
      patientId: invoice.patientId,
      currency: invoice.currency,
      total: invoice.total,
      lines: lines.map((l) => ({ description: l.description, lineAmount: l.lineAmount })),
    });
  }
}
