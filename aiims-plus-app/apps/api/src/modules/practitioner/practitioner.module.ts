import { Module } from "@nestjs/common";
import { FhirPractitionerController } from "./api/fhir-practitioner.controller";
import { PractitionerController } from "./api/practitioner.controller";
import { PractitionerService } from "./application/practitioner.service";
import { DrizzlePractitionerRepository } from "./infrastructure/practitioner.repository";
import { PRACTITIONER_REPOSITORY } from "./ports/practitioner-repository.port";

/**
 * Practitioner module (Stage 3, Master Plan §13) — the clinical profile over
 * an app_user: registration, department, specialties. Audited, tenant-scoped,
 * FHIR-regenerable (flag-gated read, default OFF).
 */
@Module({
  controllers: [PractitionerController, FhirPractitionerController],
  providers: [
    PractitionerService,
    { provide: PRACTITIONER_REPOSITORY, useClass: DrizzlePractitionerRepository },
  ],
})
export class PractitionerModule {}
