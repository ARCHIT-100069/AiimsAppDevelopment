import { Module } from "@nestjs/common";
import { PharmacyController } from "./api/pharmacy.controller";
import { PharmacyService } from "./application/pharmacy.service";

/**
 * Pharmacy module — drug formulary + batched stock, prescriptions, and FEFO
 * dispensing. Tenant-scoped (RLS), audited, outbox-backed. Uses the global
 * UnitOfWork + AuditService; adds no adapters.
 */
@Module({
  controllers: [PharmacyController],
  providers: [PharmacyService],
})
export class PharmacyModule {}
