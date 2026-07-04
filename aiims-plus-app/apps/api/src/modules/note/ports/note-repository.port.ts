/**
 * Repository port — owned by the domain (BDR-0003): intention-revealing
 * methods returning domain objects. `DataContext` is deliberately opaque so
 * neither the domain nor the application layer ever sees ORM types; the
 * infrastructure implementation narrows it to the tenant-scoped transaction.
 */
import type { Note } from "../domain/note";

export type DataContext = unknown;

export interface NoteRepository {
  insert(ctx: DataContext, note: Note): Promise<void>;
  listForTenant(ctx: DataContext): Promise<Note[]>;
}

export const NOTE_REPOSITORY = Symbol("NOTE_REPOSITORY");
