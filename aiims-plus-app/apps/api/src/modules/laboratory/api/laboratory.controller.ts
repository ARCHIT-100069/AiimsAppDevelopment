/**
 * Laboratory endpoints. Worklist (lab:read) is a facility-wide view of lab
 * orders; result filing (lab:result) files a report + structured lines and
 * closes the order. Tenant-scoped + audited by the service.
 */
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import {
  fileLabResultRequestSchema,
  type LabResultResponse,
  type LabWorklistItem,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { LaboratoryService } from "../application/laboratory.service";

const UUID = /^[0-9a-f-]{36}$/i;

@Controller("v1/lab")
export class LaboratoryController {
  constructor(private readonly lab: LaboratoryService) {}

  @Get("worklist")
  @RequirePermission("lab:read")
  async worklist(
    @CurrentPrincipal() principal: Principal,
    @Query("facilityId") facilityId?: string,
  ): Promise<{ data: LabWorklistItem[] }> {
    if (!facilityId || !UUID.test(facilityId)) {
      throw new DomainError("facilityId query parameter is required");
    }
    return { data: await this.lab.worklist(principal, facilityId) };
  }

  @Post("orders/:id/result")
  @HttpCode(201)
  @RequirePermission("lab:result")
  async fileResult(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() raw: unknown,
  ): Promise<LabResultResponse> {
    return this.lab.fileResult(principal, id, fileLabResultRequestSchema.parse(raw));
  }
}
