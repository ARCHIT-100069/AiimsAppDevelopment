import { Module } from "@nestjs/common";
import { ManagementController } from "./api/management.controller";
import { ManagementService } from "./application/management.service";

/**
 * Management module — read-only leadership analytics (OPD, revenue, lab,
 * pharmacy, satisfaction). Aggregates over operational tables; tenant-scoped
 * (RLS). Uses the global UnitOfWork; adds no adapters, writes nothing.
 */
@Module({
  controllers: [ManagementController],
  providers: [ManagementService],
})
export class ManagementModule {}
