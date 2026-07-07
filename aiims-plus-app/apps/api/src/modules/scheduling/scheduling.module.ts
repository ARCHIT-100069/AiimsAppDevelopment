import { Module } from "@nestjs/common";
import { AppointmentController } from "./api/appointment.controller";
import { AvailabilityController, SlotsController } from "./api/availability.controller";
import { EncounterController } from "./api/encounter.controller";
import { FhirAppointmentController } from "./api/fhir-appointment.controller";
import { QueueController } from "./api/queue.controller";
import { SchedulingService } from "./application/scheduling.service";
import { DrizzleSchedulingRepository } from "./infrastructure/scheduling.repository";
import { SCHEDULING_REPOSITORY } from "./ports/scheduling-repository.port";

/**
 * Scheduling module (Stage 4, Master Plan §14) — OPD appointments + the
 * encounter skeleton. Book/reschedule/cancel/no-show/check-in; double-booking
 * blocked by the DB exclusion constraint; check-in opens a clinical encounter.
 * Audited, tenant-scoped, FHIR-regenerable (flag-gated read, default OFF).
 */
@Module({
  controllers: [
    AppointmentController,
    AvailabilityController,
    SlotsController,
    QueueController,
    EncounterController,
    FhirAppointmentController,
  ],
  providers: [
    SchedulingService,
    { provide: SCHEDULING_REPOSITORY, useClass: DrizzleSchedulingRepository },
  ],
})
export class SchedulingModule {}
