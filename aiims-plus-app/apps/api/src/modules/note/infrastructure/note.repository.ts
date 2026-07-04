/**
 * Repository implementation: delegates to the typed query helpers in
 * @aiims/db (the only Drizzle home — BDR-0003) and maps rows → domain
 * objects. Always called inside a tenant-context transaction (BDR-0004).
 */
import { Injectable } from "@nestjs/common";
import { insertNote, listNotes, type TenantDb } from "@aiims/db";
import { Note } from "../domain/note";
import type { DataContext, NoteRepository } from "../ports/note-repository.port";

@Injectable()
export class DrizzleNoteRepository implements NoteRepository {
  async insert(ctx: DataContext, note: Note): Promise<void> {
    await insertNote(ctx as TenantDb, {
      id: note.props.id,
      tenantId: note.props.tenantId,
      authorId: note.props.authorId,
      body: note.props.body,
    });
  }

  async listForTenant(ctx: DataContext): Promise<Note[]> {
    const rows = await listNotes(ctx as TenantDb);
    return rows.map((r) =>
      Note.fromPersistence({
        id: r.id,
        tenantId: r.tenantId,
        authorId: r.authorId,
        body: r.body,
        createdAt: r.createdAt,
      }),
    );
  }
}
