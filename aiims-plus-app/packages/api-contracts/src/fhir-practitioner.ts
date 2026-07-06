/**
 * FHIR R4 Practitioner (+ PractitionerRole specialty) contract + pure mapper
 * (ADR-0003/DDR-0005). Regenerated from the relational model on demand; the
 * HTTP read endpoint is feature-flagged OFF by default (decision h, matching
 * the Stage 2 FHIR modification).
 */
import { z } from "zod";
import type { SpecialtyCoding } from "./practitioners";

/** Tenant-local medical-registration identifier system. */
export const registrationSystem = (tenantId: string) =>
  `urn:aiims:${tenantId}:practitioner-registration`;

export const fhirPractitionerSchema = z.object({
  resourceType: z.literal("Practitioner"),
  id: z.string(),
  active: z.boolean(),
  identifier: z.array(z.object({ system: z.string(), value: z.string() })),
  name: z.array(
    z.object({ family: z.string().optional(), given: z.array(z.string()) }).catchall(z.unknown()),
  ),
  /** PractitionerRole specialty folded in as an extension-free coding list. */
  qualification: z
    .array(
      z.object({
        code: z.object({
          coding: z.array(z.object({ system: z.string(), code: z.string(), display: z.string() })),
        }),
      }),
    )
    .optional(),
  extension: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type FhirPractitioner = z.infer<typeof fhirPractitionerSchema>;

export interface FhirPractitionerInput {
  id: string;
  tenantId: string;
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  status: "active" | "inactive";
  specialties: SpecialtyCoding[];
  fhirExtensions?: Record<string, unknown> | null;
}

export function buildFhirPractitioner(input: FhirPractitionerInput): FhirPractitioner {
  const qualification = input.specialties.length
    ? [{ code: { coding: input.specialties } }]
    : undefined;
  const extensions = Object.entries(input.fhirExtensions ?? {}).map(([url, value]) => ({
    url,
    ...(typeof value === "object" && value !== null ? value : { valueString: String(value) }),
  }));
  return fhirPractitionerSchema.parse({
    resourceType: "Practitioner",
    id: input.id,
    active: input.status === "active",
    identifier: [{ system: registrationSystem(input.tenantId), value: input.registrationNo }],
    name: [{ family: input.nameFamily, given: [input.nameGiven] }],
    ...(qualification ? { qualification } : {}),
    ...(extensions.length ? { extension: extensions } : {}),
  });
}
