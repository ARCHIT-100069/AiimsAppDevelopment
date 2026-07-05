import { Module } from "@nestjs/common";
import { FhirPatientController } from "./api/fhir-patient.controller";
import { PatientController } from "./api/patient.controller";
import { PatientService } from "./application/patient.service";
import { EncryptedPatientRepository } from "./infrastructure/patient.repository";
import { PATIENT_REPOSITORY } from "./ports/patient-repository.port";

/**
 * Patient module (Stage 2) — the first clinical bounded context.
 * Field-encrypted identifiers (DDR-0006), audited PHI access, mock ABHA
 * (ADR-0006 M1), FHIR-regenerable (flag-gated read, default OFF).
 */
@Module({
  controllers: [PatientController, FhirPatientController],
  providers: [
    PatientService,
    { provide: PATIENT_REPOSITORY, useClass: EncryptedPatientRepository },
  ],
})
export class PatientModule {}
