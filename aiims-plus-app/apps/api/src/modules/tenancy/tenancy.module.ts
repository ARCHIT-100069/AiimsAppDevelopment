import { Module } from "@nestjs/common";
import { TenancyController } from "./api/tenancy.controller";
import { TenancyService } from "./application/tenancy.service";

/**
 * Tenant registry (Stage 1). Registry rows live on the non-RLS'd isolation
 * root (DB Arch §5); every operation is PEP-gated to platform operators and
 * audited into the affected tenant's chain.
 */
@Module({
  controllers: [TenancyController],
  providers: [TenancyService],
})
export class TenancyModule {}
