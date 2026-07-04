import { describe, expect, it } from "vitest";
import { NOTE_CREATED_V1, parseEvent } from "./index";

const base = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-00000000000a",
  aggregateType: "note",
  aggregateId: "018f0000-0000-7000-8000-000000000002",
  eventType: NOTE_CREATED_V1,
  occurredAt: "2026-07-04T10:00:00.000+05:30",
  payload: {
    noteId: "018f0000-0000-7000-8000-000000000002",
    authorId: "018f0000-0000-7000-8000-000000000003",
  },
};

describe("event contracts (BDR-0005)", () => {
  it("accepts a valid versioned event", () => {
    expect(parseEvent(base).eventType).toBe(NOTE_CREATED_V1);
  });

  it("rejects unversioned event types", () => {
    expect(() => parseEvent({ ...base, eventType: "note.created" })).toThrow();
  });

  it("rejects unknown event types (consumers depend on registered contracts)", () => {
    expect(() => parseEvent({ ...base, eventType: "note.deleted.v1" })).toThrow(
      /Unknown event type/,
    );
  });

  it("rejects payloads that do not match the registered schema", () => {
    expect(() => parseEvent({ ...base, payload: { noteId: "not-a-uuid" } })).toThrow();
  });
});
