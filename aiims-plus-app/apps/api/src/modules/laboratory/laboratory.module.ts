import { Module } from "@nestjs/common";
import { LaboratoryController } from "./api/laboratory.controller";
import { LaboratoryService } from "./application/laboratory.service";

/**
 * Laboratory module — facility-wide lab worklist + result entry (structured
 * analyte lines). Builds on the Stage-5 orders/results tables; tenant-scoped
 * (RLS), audited, outbox-backed. Uses the global UnitOfWork + AuditService.
 */
@Module({
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
})
export class LaboratoryModule {}
