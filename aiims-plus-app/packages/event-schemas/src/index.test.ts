import { describe, expect, it } from "vitest";
import { DEPARTMENT_CREATED_V1, parseEvent } from "./index";

const base = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-00000000000a",
  aggregateType: "department",
  aggregateId: "018f0000-0000-7000-8000-000000000002",
  eventType: DEPARTMENT_CREATED_V1,
  occurredAt: "2026-07-05T10:00:00.000+05:30",
  payload: {
    departmentId: "018f0000-0000-7000-8000-000000000002",
    facilityId: "018f0000-0000-7000-8000-000000000003",
    code: "OPD-GEN",
  },
};

describe("event contracts (BDR-0005)", () => {
  it("accepts a valid versioned platform event", () => {
    expect(parseEvent(base).eventType).toBe(DEPARTMENT_CREATED_V1);
  });

  it("rejects unversioned event types", () => {
    expect(() => parseEvent({ ...base, eventType: "department.created" })).toThrow();
  });

  it("rejects unknown event types (consumers depend on registered contracts)", () => {
    expect(() => parseEvent({ ...base, eventType: "department.deleted.v1" })).toThrow(
      /Unknown event type/,
    );
  });

  it("rejects payloads that do not match the registered schema", () => {
    expect(() => parseEvent({ ...base, payload: { departmentId: "not-a-uuid" } })).toThrow();
  });
});
