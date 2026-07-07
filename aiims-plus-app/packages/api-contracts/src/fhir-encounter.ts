/**
 * FHIR R4 Encounter + $everything Bundle mapper (ADR-0003/DDR-0005). Regenerated
 * from the relational model on demand; the HTTP read endpoints are dark by
 * default behind `fhir.read` (matching every other FHIR surface). Kept
 * intentionally light — a demoable, schema-valid projection, not full profiling.
 */
import { z } from "zod";
import type { Coding } from "./coding";

export const fhirEncounterSchema = z.object({
  resourceType: z.literal("Encounter"),
  id: z.string(),
  status: z.string(),
  class: z.object({ code: z.string() }),
  subject: z.object({ reference: z.string() }),
  participant: z.array(z.object({ individual: z.object({ reference: z.string() }) })).optional(),
  period: z.object({ start: z.string(), end: z.string().optional() }),
  reasonCode: z.array(z.object({ text: z.string() })).optional(),
});
export type FhirEncounter = z.infer<typeof fhirEncounterSchema>;

export interface FhirEncounterInput {
  id: string;
  status: "in_progress" | "finished" | "cancelled";
  patientId: string;
  practitionerId: string;
  periodStart: string;
  periodEnd?: string | null;
  chiefComplaint?: string | null;
}

const STATUS: Record<FhirEncounterInput["status"], string> = {
  in_progress: "in-progress",
  finished: "finished",
  cancelled: "cancelled",
};

export function buildFhirEncounter(input: FhirEncounterInput): FhirEncounter {
  return fhirEncounterSchema.parse({
    resourceType: "Encounter",
    id: input.id,
    status: STATUS[input.status],
    class: { code: "AMB" },
    subject: { reference: `Patient/${input.patientId}` },
    participant: [{ individual: { reference: `Practitioner/${input.practitionerId}` } }],
    period: {
      start: input.periodStart,
      ...(input.periodEnd ? { end: input.periodEnd } : {}),
    },
    ...(input.chiefComplaint ? { reasonCode: [{ text: input.chiefComplaint }] } : {}),
  });
}

/** A FHIR Bundle (type "collection") — Encounter.$everything projection. */
export const fhirBundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  type: z.literal("collection"),
  entry: z.array(z.object({ resource: z.record(z.string(), z.unknown()) })),
});
export type FhirBundle = z.infer<typeof fhirBundleSchema>;

export interface FhirBundleInput {
  encounter: FhirEncounterInput;
  observations: {
    id: string;
    code: Coding;
    valueNumeric: number | null;
    unit: string | null;
    valueText: string | null;
    effectiveAt: string;
  }[];
  conditions: { id: string; code: Coding; clinicalStatus: string }[];
  notes: { id: string; noteType: string; body: string; createdAt: string }[];
  orders: { id: string; code: Coding; status: string }[];
  results: { id: string; serviceRequestId: string; status: string; conclusion: string }[];
}

export function buildFhirEncounterBundle(input: FhirBundleInput): FhirBundle {
  const patientRef = `Patient/${input.encounter.patientId}`;
  const encounterRef = `Encounter/${input.encounter.id}`;
  const entry: { resource: Record<string, unknown> }[] = [
    { resource: buildFhirEncounter(input.encounter) as unknown as Record<string, unknown> },
  ];

  for (const o of input.observations) {
    entry.push({
      resource: {
        resourceType: "Observation",
        id: o.id,
        status: "final",
        code: { coding: [o.code] },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        effectiveDateTime: o.effectiveAt,
        ...(o.valueNumeric !== null
          ? { valueQuantity: { value: o.valueNumeric, unit: o.unit ?? undefined } }
          : { valueString: o.valueText ?? undefined }),
      },
    });
  }
  for (const c of input.conditions) {
    entry.push({
      resource: {
        resourceType: "Condition",
        id: c.id,
        clinicalStatus: { coding: [{ code: c.clinicalStatus }] },
        code: { coding: [c.code] },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
      },
    });
  }
  for (const n of input.notes) {
    entry.push({
      resource: {
        resourceType: "DocumentReference",
        id: n.id,
        status: "current",
        type: { text: n.noteType },
        subject: { reference: patientRef },
        context: { encounter: [{ reference: encounterRef }] },
        date: n.createdAt,
        content: [
          {
            attachment: {
              contentType: "text/plain",
              data: Buffer.from(n.body, "utf8").toString("base64"),
            },
          },
        ],
      },
    });
  }
  for (const s of input.orders) {
    entry.push({
      resource: {
        resourceType: "ServiceRequest",
        id: s.id,
        status: s.status,
        intent: "order",
        code: { coding: [s.code] },
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
      },
    });
  }
  for (const r of input.results) {
    entry.push({
      resource: {
        resourceType: "DiagnosticReport",
        id: r.id,
        status: r.status,
        basedOn: [{ reference: `ServiceRequest/${r.serviceRequestId}` }],
        subject: { reference: patientRef },
        encounter: { reference: encounterRef },
        conclusion: r.conclusion,
      },
    });
  }

  return fhirBundleSchema.parse({ resourceType: "Bundle", type: "collection", entry });
}
