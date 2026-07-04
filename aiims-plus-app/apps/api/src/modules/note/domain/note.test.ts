import { describe, expect, it } from "vitest";
import { InvalidNoteError, Note } from "./note";

const base = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-00000000000a",
  authorId: "018f0000-0000-7000-8000-000000000002",
};

describe("Note domain invariants (pure, TDR-0002)", () => {
  it("creates a note with a trimmed body", () => {
    const note = Note.create({ ...base, body: "  hello  " });
    expect(note.props.body).toBe("hello");
  });

  it("rejects an empty body", () => {
    expect(() => Note.create({ ...base, body: "   " })).toThrow(InvalidNoteError);
  });

  it("rejects a body over 2000 characters", () => {
    expect(() => Note.create({ ...base, body: "x".repeat(2001) })).toThrow(InvalidNoteError);
  });
});
