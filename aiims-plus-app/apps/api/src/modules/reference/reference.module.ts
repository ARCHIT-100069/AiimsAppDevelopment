import { Module } from "@nestjs/common";
import { ReferenceController } from "./api/reference.controller";
import { ReferenceService } from "./application/reference.service";

/**
 * Reference data (DDR-0012): GLOBAL code systems (ICD-10/LOINC/SNOMED),
 * read-only to every authenticated tenant user. Not tenant-scoped by design.
 */
@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService],
})
export class ReferenceModule {}
