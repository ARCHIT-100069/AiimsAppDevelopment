import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./pagination";
import {
  assignRoleRequestSchema,
  createDepartmentRequestSchema,
  createFacilityRequestSchema,
  createTenantRequestSchema,
} from "./platform";

describe("platform contracts (Stage 1, APDR-0003)", () => {
  it("accepts a valid tenant slug and rejects unsafe ones", () => {
    expect(
      createTenantRequestSchema.safeParse({ slug: "city-care-3", name: "City Care" }).success,
    ).toBe(true);
    for (const bad of ["Ab", "UPPER", "has_underscore", "-lead", "trail-", "a b"]) {
      expect(createTenantRequestSchema.safeParse({ slug: bad, name: "x" }).success).toBe(false);
    }
  });

  it("department codes are uppercase alphanumerics", () => {
    const base = { facilityId: "018f0000-0000-7000-8000-000000000001", name: "OPD General" };
    expect(createDepartmentRequestSchema.safeParse({ ...base, code: "OPD-GEN" }).success).toBe(
      true,
    );
    expect(createDepartmentRequestSchema.safeParse({ ...base, code: "opd gen" }).success).toBe(
      false,
    );
  });

  it("facility timezone defaults to Asia/Kolkata (India-first)", () => {
    const parsed = createFacilityRequestSchema.parse({
      organizationId: "018f0000-0000-7000-8000-000000000001",
      name: "Main Campus",
    });
    expect(parsed.timezone).toBe("Asia/Kolkata");
  });

  it("role assignment accepts only known role codes", () => {
    expect(assignRoleRequestSchema.safeParse({ roleCode: "doctor" }).success).toBe(true);
    expect(assignRoleRequestSchema.safeParse({ roleCode: "superuser" }).success).toBe(false);
  });

  it("cursors round-trip and malformed cursors degrade to first page", () => {
    const c = encodeCursor({
      c: "2026-07-05T10:00:00.000Z",
      id: "018f0000-0000-7000-8000-000000000001",
    });
    expect(decodeCursor(c)?.id).toBe("018f0000-0000-7000-8000-000000000001");
    expect(decodeCursor("not-a-cursor")).toBeUndefined();
  });
});
