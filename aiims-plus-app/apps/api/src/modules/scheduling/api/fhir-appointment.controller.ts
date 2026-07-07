/**
 * FHIR R4 Appointment read — APDR-0012 boundary, feature-flagged OFF BY DEFAULT
 * (dark behind `fhir.read`, matching Patient/Practitioner). When disabled the
 * route answers 404 (no surface disclosure).
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import {
  buildFhirAppointment,
  type FhirAppointment,
  type SpecialtyCoding,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { SchedulingService } from "../application/scheduling.service";

@Controller("fhir/R4/Appointment")
export class FhirAppointmentController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get(":id")
  @RequirePermission("appointment:read")
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FhirAppointment> {
    if (!(await this.flags.isEnabled("fhir.read", principal.tenantId))) {
      throw new NotFoundError("Not found"); // dark by default
    }
    const appointment = await this.scheduling.getById(principal, id);
    const p = appointment.props;
    return buildFhirAppointment({
      id: p.id,
      status: p.status,
      startAt: p.startAt.toISOString(),
      endAt: p.endAt.toISOString(),
      appointmentType: p.appointmentType,
      patientId: p.patientId,
      practitionerId: p.practitionerId,
      specialties: p.specialties as SpecialtyCoding[],
      reasonText: p.reasonText,
    });
  }
}
