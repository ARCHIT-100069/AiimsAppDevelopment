import { describe, expect, it } from "vitest";
import { amendNoteRequestSchema, createNoteRequestSchema } from "./clinical-notes";
import { createObservationRequestSchema } from "./observations";
import { signEncounterRequestSchema } from "./encounters";
import { createResultRequestSchema } from "./orders";
import { presignUploadRequestSchema } from "./attachments";
import { buildFhirEncounter, buildFhirEncounterBundle } from "./fhir-encounter";

describe("EMR contracts (Stage 5)", () => {
  it("note create defaults type; amend requires a reason (DDR-0013)", () => {
    expect(createNoteRequestSchema.parse({ body: "seen, stable" }).noteType).toBe("progress");
    expect(amendNoteRequestSchema.safeParse({ body: "corrected" }).success).toBe(false);
    expect(amendNoteRequestSchema.safeParse({ body: "corrected", reason: "typo" }).success).toBe(
      true,
    );
  });

  it("observation requires a numeric or text value", () => {
    const c = { system: "loinc", code: "8867-4", display: "Heart rate" };
    expect(createObservationRequestSchema.safeParse({ code: c }).success).toBe(false);
    expect(
      createObservationRequestSchema.safeParse({ code: c, valueNumeric: 72, unit: "bpm" }).success,
    ).toBe(true);
  });

  it("sign requires an explicit attestation (Constitution)", () => {
    expect(signEncounterRequestSchema.safeParse({ attestation: false }).success).toBe(false);
    expect(signEncounterRequestSchema.safeParse({ attestation: true }).success).toBe(true);
  });

  it("presign-upload caps size and validates content type", () => {
    expect(
      presignUploadRequestSchema.safeParse({
        fileName: "report.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
    expect(
      presignUploadRequestSchema.safeParse({
        fileName: "x",
        contentType: "not-a-mime",
        sizeBytes: 1,
      }).success,
    ).toBe(false);
  });

  it("result defaults to final", () => {
    expect(createResultRequestSchema.parse({ conclusion: "normal" }).status).toBe("final");
  });
});

describe("FHIR Encounter + $everything bundle (ADR-0003/DDR-0005)", () => {
  const enc = {
    id: "0197a000-0000-7000-8000-000000000001",
    status: "finished" as const,
    patientId: "0197a000-0000-7000-8000-000000000002",
    practitionerId: "0197a000-0000-7000-8000-000000000003",
    periodStart: "2026-08-01T09:00:00.000Z",
    periodEnd: "2026-08-01T09:30:00.000Z",
    chiefComplaint: "fever",
  };

  it("maps a finished encounter with class AMB and participant", () => {
    const fhir = buildFhirEncounter(enc);
    expect(fhir.resourceType).toBe("Encounter");
    expect(fhir.status).toBe("finished");
    expect(fhir.class.code).toBe("AMB");
    expect(fhir.subject.reference).toBe(`Patient/${enc.patientId}`);
    expect(fhir.reasonCode?.[0]?.text).toBe("fever");
  });

  it("$everything bundles children referencing the encounter", () => {
    const bundle = buildFhirEncounterBundle({
      encounter: enc,
      observations: [
        {
          id: "0197a000-0000-7000-8000-0000000000a1",
          code: { system: "loinc", code: "8310-5", display: "Body temperature" },
          valueNumeric: 38.5,
          unit: "Cel",
          valueText: null,
          effectiveAt: enc.periodStart,
        },
      ],
      conditions: [
        {
          id: "0197a000-0000-7000-8000-0000000000b1",
          code: { system: "icd-10", code: "R50.9", display: "Fever, unspecified" },
          clinicalStatus: "active",
        },
      ],
      notes: [
        {
          id: "0197a000-0000-7000-8000-0000000000c1",
          noteType: "progress",
          body: "febrile, hydrated, advised rest",
          createdAt: enc.periodStart,
        },
      ],
      orders: [
        {
          id: "0197a000-0000-7000-8000-0000000000d1",
          code: { system: "loinc", code: "718-7", display: "Hemoglobin" },
          status: "active",
        },
      ],
      results: [
        {
          id: "0197a000-0000-7000-8000-0000000000e1",
          serviceRequestId: "0197a000-0000-7000-8000-0000000000d1",
          status: "final",
          conclusion: "Hb 13.2 g/dL — normal",
        },
      ],
    });
    expect(bundle.resourceType).toBe("Bundle");
    // Encounter + 1 obs + 1 condition + 1 note + 1 order + 1 result = 6 entries.
    expect(bundle.entry).toHaveLength(6);
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types).toContain("Observation");
    expect(types).toContain("DiagnosticReport");
  });
});
