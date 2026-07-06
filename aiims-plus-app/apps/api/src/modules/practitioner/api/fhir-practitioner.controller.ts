/**
 * FHIR R4 Practitioner read — APDR-0012 boundary, feature-flagged OFF BY
 * DEFAULT (decision h, matching the Stage 2 FHIR modification). Mapper +
 * contract + tests are live; the HTTP surface returns 404 until `fhir.read`
 * is enabled.
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  buildFhirPractitioner,
  type FhirPractitioner,
  type SpecialtyCoding,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { PractitionerService } from "../application/practitioner.service";

@Controller("fhir/R4/Practitioner")
export class FhirPractitionerController {
  constructor(
    private readonly practitioners: PractitionerService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get(":id")
  @RequirePermission("practitioner:read")
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirPractitioner> {
    if (!(await this.flags.isEnabled("fhir.read", principal.tenantId))) {
      throw new NotFoundError("Not found"); // dark by default
    }
    const practitioner = await this.practitioners.getById(principal, id); // audited read
    const p = practitioner.props;
    return buildFhirPractitioner({
      id: p.id,
      tenantId: p.tenantId,
      nameGiven: p.nameGiven,
      nameFamily: p.nameFamily,
      registrationNo: p.registrationNo,
      status: p.status,
      specialties: p.specialties as SpecialtyCoding[],
    });
  }
}
