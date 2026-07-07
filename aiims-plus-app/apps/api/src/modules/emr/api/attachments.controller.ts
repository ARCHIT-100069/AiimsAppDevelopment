/**
 * Attachment download endpoint (Stage 5, APDR-0007). Returns a short-lived
 * presigned GET URL; the client fetches bytes directly from object storage.
 */
import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import type { PresignDownloadResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { EmrService } from "../application/emr.service";

@Controller("v1/attachments")
export class AttachmentsController {
  constructor(private readonly emr: EmrService) {}

  @Get(":id/download-url")
  @RequirePermission("result:read")
  async download(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PresignDownloadResponse> {
    return this.emr.presignDownload(principal, id);
  }
}
