import { Module } from "@nestjs/common";
import { NoteController } from "./api/note.controller";
import { NoteService } from "./application/note.service";
import { DrizzleNoteRepository } from "./infrastructure/note.repository";
import { NOTE_REPOSITORY } from "./ports/note-repository.port";

/** Stage 0 walking-skeleton proof module — removed when Stage 1 lands. */
@Module({
  controllers: [NoteController],
  providers: [NoteService, { provide: NOTE_REPOSITORY, useClass: DrizzleNoteRepository }],
})
export class NoteModule {}
