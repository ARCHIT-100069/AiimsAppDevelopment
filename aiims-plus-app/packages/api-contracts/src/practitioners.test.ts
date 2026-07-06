import { describe, expect, it } from "vitest";
import {
  createPractitionerRequestSchema,
  createPractitionerResponseSchema,
  searchPractitionersQuerySchema,
  updatePractitionerRequestSchema,
} from "./practitioners";

const uuid = "0197a000-0000-7000-8000-000000000001";

describe("practitioner contracts (Stage 3)", () => {
  it("create requires appUserId + a valid registration number, specialties default to []", () => {
    const parsed = createPractitionerRequestSchema.parse({
      appUserId: uuid,
      registrationNo: "MCI-12345",
    });
    expect(parsed.specialties).toEqual([]);
    expect(createPractitionerRequestSchema.safeParse({ registrationNo: "MCI-1" }).success).toBe(
      false,
    );
    expect(
      createPractitionerRequestSchema.safeParse({ appUserId: uuid, registrationNo: "bad space" })
        .success,
    ).toBe(false);
  });

  it("update DTO has NO appUserId field (immutable link) and requires ≥1 field", () => {
    // An appUserId in the body is silently stripped — it can never be updated.
    const parsed = updatePractitionerRequestSchema.parse({
      status: "inactive",
      appUserId: "0197a000-0000-7000-8000-0000000000ff",
    } as Record<string, unknown>);
    expect("appUserId" in parsed).toBe(false);
    // Empty patch is rejected.
    expect(updatePractitionerRequestSchema.safeParse({}).success).toBe(false);
  });

  it("create response carries a default-empty warnings array (decision i)", () => {
    const parsed = createPractitionerResponseSchema.parse({
      id: uuid,
      appUserId: uuid,
      nameGiven: "Asha",
      nameFamily: "Rao",
      registrationNo: "MCI-12345",
      departmentId: null,
      specialties: [],
      status: "active",
      version: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.warnings).toEqual([]);
  });

  it("search allow-lists at most one filter (APDR-0005)", () => {
    expect(searchPractitionersQuerySchema.safeParse({ q: "asha" }).success).toBe(true);
    expect(
      searchPractitionersQuerySchema.safeParse({ q: "asha", registrationNo: "MCI-1" }).success,
    ).toBe(false);
  });
});
