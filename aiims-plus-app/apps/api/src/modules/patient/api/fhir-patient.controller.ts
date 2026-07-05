/**
 * FHIR R4 Patient read — APDR-0012 boundary, feature-flagged OFF BY DEFAULT
 * (founder decision, Stage 2): the mapper/contracts/tests are live; the HTTP
 * surface stays dark until the FHIR stage flips `fhir.read`. When disabled
 * the route answers 404 (no surface disclosure).
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { buildFhirPatient, type FhirPatient } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { PatientService } from "../application/patient.service";

@Controller("fhir/R4/Patient")
export class FhirPatientController {
  constructor(
    private readonly patients: PatientService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get(":id")
  @RequirePermission("patient:read")
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirPatient> {
    if (!(await this.flags.isEnabled("fhir.read", principal.tenantId))) {
      throw new NotFoundError("Not found"); // dark by default
    }
    const patient = await this.patients.getById(principal, id); // audited PHI read
    const p = patient.props;
    return buildFhirPatient({
      id: p.id,
      tenantId: p.tenantId,
      mrn: p.mrn,
      nameGiven: p.nameGiven,
      nameFamily: p.nameFamily,
      gender: p.gender,
      birthDate: p.birthDate,
      phone: p.phone,
      email: p.email,
      abhaNumber: p.abhaNumber,
      abhaAddress: p.abhaAddress,
      address: p.address,
    });
  }
}
