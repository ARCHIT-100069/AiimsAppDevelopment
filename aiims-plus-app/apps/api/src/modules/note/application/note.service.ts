/**
 * Application service = the use-case orchestrator and TRANSACTION BOUNDARY
 * (BDR-0004). createNote is the Stage 0 exit-criterion proof:
 *
 *   one tenant-scoped transaction =
 *     business write (platform.note)
 *   + outbox event (note.created.v1, DDR-0007)
 *   + hash-chained audit row (ADR-0005)
 *
 * — committed atomically, then fanned out by the dispatcher.
 */
import { Inject, Injectable } from "@nestjs/common";
import { insertOutboxEvent, newId, type TenantDb } from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { NOTE_CREATED_V1 } from "@aiims/event-schemas";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";
import { DomainError } from "../../../common/errors";
import { InvalidNoteError, Note } from "../domain/note";
import { NOTE_REPOSITORY, type NoteRepository } from "../ports/note-repository.port";

@Injectable()
export class NoteService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(NOTE_REPOSITORY) private readonly notes: NoteRepository,
  ) {}

  async createNote(principal: Principal, body: string): Promise<Note> {
    let note: Note;
    try {
      note = Note.create({
        id: newId(),
        tenantId: principal.tenantId,
        authorId: principal.actorId,
        body,
      });
    } catch (err) {
      if (err instanceof InvalidNoteError) throw new DomainError(err.message);
      throw err;
    }

    await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      async (db: TenantDb) => {
        await this.notes.insert(db, note);

        const eventId = newId();
        const occurredAt = new Date();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "note",
          aggregateId: note.props.id,
          eventType: NOTE_CREATED_V1,
          // References only — the note body is NOT in the event (SDR-0004).
          payload: { noteId: note.props.id, authorId: principal.actorId },
        });

        await this.audit.append(db, principal, {
          eventId,
          action: "note.create",
          resourceType: "note",
          resourceId: note.props.id,
          occurredAt,
        });
      },
    );

    return note;
  }

  async listNotes(principal: Principal): Promise<Note[]> {
    return this.uow.withTenant({ tenantId: principal.tenantId, actorId: principal.actorId }, (db) =>
      this.notes.listForTenant(db),
    );
  }
}
