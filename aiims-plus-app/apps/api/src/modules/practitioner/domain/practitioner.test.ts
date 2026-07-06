import { describe, expect, it } from "vitest";
import { InvalidPractitionerError, Practitioner } from "./practitioner";

const base = {
  id: "018f0000-0000-7000-8000-000000000001",
  tenantId: "018f0000-0000-7000-8000-00000000000a",
  appUserId: "018f0000-0000-7000-8000-000000000002",
  nameGiven: "Asha",
  nameFamily: "Rao",
  registrationNo: "MCI-12345",
};

describe("Practitioner domain (pure, TDR-0002)", () => {
  it("registers with trimmed names and default active status", () => {
    const p = Practitioner.register({ ...base, nameGiven: "  Asha  " });
    expect(p.props.nameGiven).toBe("Asha");
    expect(p.props.status).toBe("active");
    expect(p.props.version).toBe(0);
  });

  it("rejects empty names and blank registration", () => {
    expect(() => Practitioner.register({ ...base, nameGiven: "  " })).toThrow(
      InvalidPractitionerError,
    );
    expect(() => Practitioner.register({ ...base, registrationNo: "   " })).toThrow(
      InvalidPractitionerError,
    );
  });

  it("withChanges cannot alter appUserId or registrationNo (immutable link/credential)", () => {
    const p = Practitioner.register(base);
    // The change API has no field for either — this documents the invariant.
    const updated = p.withChanges({ status: "inactive", nameGiven: "Asha Devi" });
    expect(updated.props.appUserId).toBe(base.appUserId);
    expect(updated.props.registrationNo).toBe(base.registrationNo);
    expect(updated.props.status).toBe("inactive");
    expect(updated.props.nameGiven).toBe("Asha Devi");
  });

  it("withChanges updates department and specialties", () => {
    const p = Practitioner.register(base).withChanges({
      departmentId: "018f0000-0000-7000-8000-000000000009",
      specialties: [{ system: "specialty", code: "cardiology", display: "Cardiology" }],
    });
    expect(p.props.departmentId).toBe("018f0000-0000-7000-8000-000000000009");
    expect(p.props.specialties[0]?.code).toBe("cardiology");
  });
});
