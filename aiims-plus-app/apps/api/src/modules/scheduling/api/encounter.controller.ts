/**
 * Encounter read endpoint (Stage 4 skeleton). The write surface (documentation,
 * sign/finalize) arrives in Stage 5; here the encounter is read-only.
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import type { EncounterResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { SchedulingService } from "../application/scheduling.service";
import type { Encounter } from "../domain/encounter";

export function toEncounterResponse(e: Encounter): EncounterResponse {
  const p = e.props;
  return {
    id: p.id,
    appointmentId: p.appointmentId,
    patientId: p.patientId,
    practitionerId: p.practitionerId,
    facilityId: p.facilityId,
    departmentId: p.departmentId,
    class: p.class,
    status: p.status,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd ? p.periodEnd.toISOString() : null,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
  };
}

@Controller("v1/encounters")
export class EncounterController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get(":id")
  @RequirePermission("encounter:read")
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EncounterResponse> {
    return toEncounterResponse(await this.scheduling.getEncounterById(principal, id));
  }
}
