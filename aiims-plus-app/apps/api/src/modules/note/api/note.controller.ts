/**
 * Controller (BDR-0001): HTTP only — validate via api-contracts Zod, call ONE
 * application service, map to the response contract. No business logic.
 */
import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  createNoteRequestSchema,
  type ListNotesResponse,
  type NoteResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { NoteService } from "../application/note.service";
import type { Note } from "../domain/note";

function toResponse(note: Note): NoteResponse {
  return {
    id: note.props.id,
    body: note.props.body,
    createdAt: note.props.createdAt.toISOString(),
  } as NoteResponse;
}

@Controller("v1/notes")
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @HttpCode(201)
  @RequirePermission("note:create")
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<NoteResponse> {
    const request = createNoteRequestSchema.parse(rawBody); // 422 on failure (APDR-0003)
    const note = await this.noteService.createNote(principal, request.body);
    return toResponse(note);
  }

  @Get()
  @RequirePermission("note:read")
  async list(@CurrentPrincipal() principal: Principal): Promise<ListNotesResponse> {
    const notes = await this.noteService.listNotes(principal);
    return {
      data: notes.map(toResponse),
      meta: { nextCursor: null }, // cursor pagination lands with real modules (APDR-0005)
    };
  }
}
