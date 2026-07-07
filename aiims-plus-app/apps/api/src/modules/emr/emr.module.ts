import { Module } from "@nestjs/common";
import { AttachmentsController } from "./api/attachments.controller";
import { EmrController } from "./api/emr.controller";
import { FhirEncounterController } from "./api/fhir-encounter.controller";
import { NotesController } from "./api/notes.controller";
import { ResultsController } from "./api/results.controller";
import { EmrService } from "./application/emr.service";

/**
 * EMR module (Stage 5, Master Plan §15) — the clinical heart. Encounter
 * documentation (notes/vitals/diagnoses), orders + results, presigned
 * attachments, and sign/finalize. Constitution-bound: sign is human/doctor-only
 * and NO AI gateway is imported here. Audited, tenant-scoped, FHIR-regenerable
 * (flag-gated read, default OFF).
 */
@Module({
  controllers: [
    EmrController,
    NotesController,
    ResultsController,
    AttachmentsController,
    FhirEncounterController,
  ],
  providers: [EmrService],
})
export class EmrModule {}
