/**
 * FHIR R4 Patient contract + pure shape mapper (ADR-0003/DDR-0005).
 *
 * The relational model stays the system of record; this builds a valid FHIR
 * R4 Patient ON DEMAND. It lives in api-contracts as a pure wire-format
 * function; the ABDM adapter composes it into consent-gated bundles at the
 * exchange boundary in Stage 6 (APDR-0012). The HTTP read endpoint is
 * feature-flagged OFF by default (founder decision, Stage 2).
 *
 * India-profile note: the NDHM field audit (DB Arch §19.1) remains a tracked
 * open item; unmapped required fields ride in fhir_extensions so fidelity is
 * never lost (DDR-0005).
 */
import { z } from "zod";
import { GENDERS } from "./patients";

export const ABHA_NUMBER_SYSTEM = "https://healthid.abdm.gov.in";
export const ABHA_ADDRESS_SYSTEM = "https://healthid.abdm.gov.in/abha-address";
/** Tenant-local MRN system URI; the tenant id keeps it globally unambiguous. */
export const mrnSystem = (tenantId: string) => `urn:aiims:${tenantId}:mrn`;

export const fhirPatientSchema = z.object({
  resourceType: z.literal("Patient"),
  id: z.string(),
  identifier: z.array(z.object({ system: z.string(), value: z.string() }).catchall(z.unknown())),
  name: z.array(
    z.object({ family: z.string().optional(), given: z.array(z.string()) }).catchall(z.unknown()),
  ),
  gender: z.enum(GENDERS),
  birthDate: z.iso.date(),
  telecom: z.array(z.object({ system: z.enum(["phone", "email"]), value: z.string() })).optional(),
  address: z.array(z.record(z.string(), z.unknown())).optional(),
  extension: z.array(z.record(z.string(), z.unknown())).optional(),
});
export type FhirPatient = z.infer<typeof fhirPatientSchema>;

export interface FhirPatientInput {
  id: string;
  tenantId: string;
  mrn: string;
  nameGiven: string;
  nameFamily: string;
  gender: (typeof GENDERS)[number];
  birthDate: string;
  phone?: string | null;
  email?: string | null;
  abhaNumber?: string | null;
  abhaAddress?: string | null;
  address?: Record<string, unknown> | null;
  fhirExtensions?: Record<string, unknown> | null;
}

/** Regenerate a FHIR R4 Patient from the relational shape (never the OLTP store). */
export function buildFhirPatient(input: FhirPatientInput): FhirPatient {
  const identifier: FhirPatient["identifier"] = [
    { system: mrnSystem(input.tenantId), value: input.mrn },
  ];
  if (input.abhaNumber) identifier.push({ system: ABHA_NUMBER_SYSTEM, value: input.abhaNumber });
  if (input.abhaAddress) identifier.push({ system: ABHA_ADDRESS_SYSTEM, value: input.abhaAddress });

  const telecom: NonNullable<FhirPatient["telecom"]> = [];
  if (input.phone) telecom.push({ system: "phone", value: input.phone });
  if (input.email) telecom.push({ system: "email", value: input.email });

  const extensions = Object.entries(input.fhirExtensions ?? {}).map(([url, value]) => ({
    url,
    ...(typeof value === "object" && value !== null ? value : { valueString: String(value) }),
  }));

  return fhirPatientSchema.parse({
    resourceType: "Patient",
    id: input.id,
    identifier,
    name: [{ family: input.nameFamily, given: [input.nameGiven] }],
    gender: input.gender,
    birthDate: input.birthDate,
    ...(telecom.length ? { telecom } : {}),
    ...(input.address ? { address: [input.address] } : {}),
    ...(extensions.length ? { extension: extensions } : {}),
  });
}
