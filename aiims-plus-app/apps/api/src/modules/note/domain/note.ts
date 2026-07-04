/**
 * Note domain entity — Stage 0 walking-skeleton proof (NOT a clinical
 * feature; removed in Stage 1). Pure and framework-free (BDR-0001): no
 * NestJS, no ORM, no IO. Invariants live here, not in controllers.
 */

export interface NoteProps {
  readonly id: string;
  readonly tenantId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: Date;
}

export class InvalidNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNoteError";
  }
}

export class Note {
  private constructor(readonly props: NoteProps) {}

  /** Factory enforcing the domain invariant (bounded, non-empty body). */
  static create(input: { id: string; tenantId: string; authorId: string; body: string }): Note {
    const body = input.body.trim();
    if (body.length === 0) throw new InvalidNoteError("Note body must not be empty");
    if (body.length > 2000) throw new InvalidNoteError("Note body exceeds 2000 characters");
    return new Note({ ...input, body, createdAt: new Date() });
  }

  static fromPersistence(props: NoteProps): Note {
    return new Note(props);
  }
}
