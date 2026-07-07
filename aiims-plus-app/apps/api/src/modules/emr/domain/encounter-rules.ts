/**
 * EMR domain rules (Stage 5) — pure, framework-free (BDR-0001). The clinical
 * invariants that make documentation safe and the Constitution enforceable:
 *   - documentation is only allowed on an OPEN (in_progress, unsigned) encounter;
 *   - signing finalizes and freezes; post-sign changes require an amendment
 *     (a NEW note version, DDR-0013) — never mutation of a signed record.
 */

export interface EncounterState {
  status: "in_progress" | "finished" | "cancelled";
  signedAt: Date | null;
}

export class EncounterNotEditableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncounterNotEditableError";
  }
}

/** Documentation writes require an open, unsigned encounter. */
export function assertDocumentable(enc: EncounterState): void {
  if (enc.status !== "in_progress" || enc.signedAt !== null) {
    throw new EncounterNotEditableError(
      "Encounter is signed/finalized — create an amendment instead of editing",
    );
  }
}

/** Signing requires an open, not-yet-signed encounter. */
export function assertSignable(enc: EncounterState): void {
  if (enc.status !== "in_progress" || enc.signedAt !== null) {
    throw new EncounterNotEditableError("Encounter is not open for signing");
  }
}

/** The next version number for an amended note (append-only, DDR-0013). */
export function nextNoteVersion(latestVersion: number): number {
  return latestVersion + 1;
}
