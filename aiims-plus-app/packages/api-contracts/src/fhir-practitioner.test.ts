import { describe, expect, it } from "vitest";
import {
  buildFhirPractitioner,
  fhirPractitionerSchema,
  registrationSystem,
} from "./fhir-practitioner";

describe("FHIR Practitioner mapper (ADR-0003/DDR-0005)", () => {
  const input = {
    id: "018f0000-0000-7000-8000-000000000001",
    tenantId: "018f0000-0000-7000-8000-00000000000a",
    nameGiven: "Asha",
    nameFamily: "Rao",
    registrationNo: "MCI-12345",
    status: "active" as const,
    specialties: [{ system: "specialty", code: "cardiology", display: "Cardiology" }],
  };

  it("regenerates a valid FHIR R4 Practitioner with registration identifier + specialty", () => {
    const fhir = buildFhirPractitioner(input);
    expect(fhirPractitionerSchema.safeParse(fhir).success).toBe(true);
    expect(fhir.resourceType).toBe("Practitioner");
    expect(fhir.active).toBe(true);
    expect(fhir.identifier[0]).toEqual({
      system: registrationSystem(input.tenantId),
      value: "MCI-12345",
    });
    expect(fhir.name[0]).toEqual({ family: "Rao", given: ["Asha"] });
    expect(fhir.qualification?.[0]?.code.coding[0]?.code).toBe("cardiology");
  });

  it("maps inactive status and omits qualification when no specialties", () => {
    const fhir = buildFhirPractitioner({ ...input, status: "inactive", specialties: [] });
    expect(fhir.active).toBe(false);
    expect(fhir.qualification).toBeUndefined();
  });
});
