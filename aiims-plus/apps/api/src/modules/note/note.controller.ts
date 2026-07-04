import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../platform/auth.guard.js";
import { AuthzGuard, RequirePerm } from "../../platform/authz.guard.js";
import { NoteService } from "./note.service.js";
import { CreateNoteRequest } from "@aiims/api-contracts";

@Controller({ path: "notes", version: "1" })
@UseGuards(AuthGuard, AuthzGuard)
export class NoteController {
  constructor(private notes: NoteService) {}

  @Post()
  @RequirePerm("note", "create")
  async create(@Req() req: any, @Body() raw: unknown) {
    const dto = CreateNoteRequest.parse(raw); // edge validation (APDR-0003)
    return this.notes.create(req.principal.tenantId, req.principal.userId, dto.body);
  }

  @Get()
  @RequirePerm("note", "read")
  async list(@Req() req: any) { return this.notes.list(req.principal.tenantId); }
}
