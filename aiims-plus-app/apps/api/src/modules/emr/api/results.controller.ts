/**
 * Result-filing endpoint (Stage 5). A diagnostic report is filed against an
 * order (ServiceRequest); results may arrive after the encounter is signed.
 */
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { createResultRequestSchema, type ResultResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { EmrService } from "../application/emr.service";
import { toResultResponse } from "./emr.mappers";

@Controller("v1/orders")
export class ResultsController {
  constructor(private readonly emr: EmrService) {}

  @Post(":id/results")
  @HttpCode(201)
  @RequirePermission("result:file")
  async fileResult(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<ResultResponse> {
    const req = createResultRequestSchema.parse(rawBody);
    return toResultResponse(await this.emr.fileResult(principal, id, req));
  }
}
