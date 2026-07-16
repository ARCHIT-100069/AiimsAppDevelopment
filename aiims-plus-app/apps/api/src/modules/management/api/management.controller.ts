/**
 * Management endpoints (leadership analytics, read-only). Aggregate rollups
 * only — no PHI. Tenant-scoped under RLS by the service.
 */
import { Controller, Get } from "@nestjs/common";
import type { ManagementOverview } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { ManagementService } from "../application/management.service";

@Controller("v1/management")
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get("overview")
  @RequirePermission("management:read")
  async overview(@CurrentPrincipal() principal: Principal): Promise<ManagementOverview> {
    return this.management.overview(principal);
  }
}
