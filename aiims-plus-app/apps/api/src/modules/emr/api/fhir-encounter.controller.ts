/**
 * FHIR R4 Encounter reads (Stage 5) — dark by default behind `fhir.read`
 * (matching every other FHIR surface). `$everything` returns a Bundle of the
 * encounter plus its observations/conditions/notes/orders/results.
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  buildFhirEncounter,
  buildFhirEncounterBundle,
  type FhirBundle,
  type FhirEncounter,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { EmrService } from "../application/emr.service";

@Controller("fhir/R4/Encounter")
export class FhirEncounterController {
  constructor(
    private readonly emr: EmrService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get(":id")
  @RequirePermission("encounter:read")
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirEncounter> {
    await this.assertEnabled(principal);
    const e = await this.emr.getEncounter(principal, id);
    return buildFhirEncounter({
      id: e.id,
      status: e.status,
      patientId: e.patientId,
      practitionerId: e.practitionerId,
      periodStart: e.periodStart.toISOString(),
      periodEnd: e.periodEnd ? e.periodEnd.toISOString() : null,
      chiefComplaint: e.chiefComplaint,
    });
  }

  @Get(":id/$everything")
  @RequirePermission("encounter:read")
  async everything(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirBundle> {
    await this.assertEnabled(principal);
    const { encounter, observations, conditions, notes, orders, results } =
      await this.emr.encounterEverything(principal, id);
    return buildFhirEncounterBundle({
      encounter: {
        id: encounter.id,
        status: encounter.status,
        patientId: encounter.patientId,
        practitionerId: encounter.practitionerId,
        periodStart: encounter.periodStart.toISOString(),
        periodEnd: encounter.periodEnd ? encounter.periodEnd.toISOString() : null,
        chiefComplaint: encounter.chiefComplaint,
      },
      observations: observations.map((o) => ({
        id: o.id,
        code: { system: o.codeSystem, code: o.code, display: o.display },
        valueNumeric: o.valueNumeric !== null ? Number(o.valueNumeric) : null,
        unit: o.unit,
        valueText: o.valueText,
        effectiveAt: o.effectiveAt.toISOString(),
      })),
      conditions: conditions.map((c) => ({
        id: c.id,
        code: { system: c.codeSystem, code: c.code, display: c.display },
        clinicalStatus: c.clinicalStatus,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        noteType: n.noteType,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
      })),
      orders: orders.map((s) => ({
        id: s.id,
        code: { system: s.codeSystem, code: s.code, display: s.display },
        status: s.status,
      })),
      results: results.map((r) => ({
        id: r.id,
        serviceRequestId: r.serviceRequestId,
        status: r.status,
        conclusion: r.conclusion,
      })),
    });
  }

  private async assertEnabled(principal: Principal): Promise<void> {
    if (!(await this.flags.isEnabled("fhir.read", principal.tenantId))) {
      throw new NotFoundError("Not found"); // dark by default
    }
  }
}
