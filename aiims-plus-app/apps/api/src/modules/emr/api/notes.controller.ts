/**
 * Note amendment endpoint (Stage 5, DDR-0013). Amending creates a NEW version
 * that supersedes the prior — allowed even after the encounter is signed (that
 * is the point of amendments). The prior version is retained, never mutated.
 */
import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { amendNoteRequestSchema, type NoteResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { EmrService } from "../application/emr.service";
import { toNoteResponse } from "./emr.mappers";

@Controller("v1/notes")
export class NotesController {
  constructor(private readonly emr: EmrService) {}

  @Post(":id/amend")
  @HttpCode(201)
  @RequirePermission("encounter:document")
  async amend(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<NoteResponse> {
    const req = amendNoteRequestSchema.parse(rawBody);
    return toNoteResponse(await this.emr.amendNote(principal, id, req));
  }
}
