import { describe, expect, it } from "vitest";
import {
  assertDocumentable,
  assertSignable,
  EncounterNotEditableError,
  nextNoteVersion,
} from "./encounter-rules";

describe("EMR encounter rules (pure, TDR-0002)", () => {
  it("allows documentation only on an open, unsigned encounter", () => {
    expect(() => assertDocumentable({ status: "in_progress", signedAt: null })).not.toThrow();
    expect(() => assertDocumentable({ status: "finished", signedAt: new Date() })).toThrow(
      EncounterNotEditableError,
    );
    // Defensive: signed timestamp set but status somehow still open ⇒ still frozen.
    expect(() => assertDocumentable({ status: "in_progress", signedAt: new Date() })).toThrow(
      EncounterNotEditableError,
    );
  });

  it("allows signing only an open, not-yet-signed encounter", () => {
    expect(() => assertSignable({ status: "in_progress", signedAt: null })).not.toThrow();
    expect(() => assertSignable({ status: "finished", signedAt: new Date() })).toThrow(
      EncounterNotEditableError,
    );
    expect(() => assertSignable({ status: "cancelled", signedAt: null })).toThrow(
      EncounterNotEditableError,
    );
  });

  it("amendment version increments (append-only, DDR-0013)", () => {
    expect(nextNoteVersion(1)).toBe(2);
    expect(nextNoteVersion(7)).toBe(8);
  });
});
