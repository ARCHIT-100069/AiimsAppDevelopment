/**
 * Encounter contracts (Stage 4 skeleton, decision D-4.1). Check-in OPENS an
 * encounter (§14); Stage 5 (EMR) EXTENDS this aggregate with documentation
 * (notes/observations/conditions/orders) and the sign/finalize lifecycle —
 * it never redesigns it. `appointmentId` is nullable so future walk-ins (no
 * prior appointment) attach without a schema change (decision D-4.8).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

/** FHIR Encounter.class — OPD is ambulatory. */
export const ENCOUNTER_CLASSES = ["AMB"] as const;
export const ENCOUNTER_STATUSES = ["in_progress", "finished", "cancelled"] as const;
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];

export const encounterResponseSchema = z.object({
  id: uuidSchema,
  appointmentId: uuidSchema.nullable(),
  patientId: uuidSchema,
  practitionerId: uuidSchema,
  facilityId: uuidSchema,
  departmentId: uuidSchema.nullable(),
  class: z.enum(ENCOUNTER_CLASSES),
  status: z.enum(ENCOUNTER_STATUSES),
  /** Stage 5 documentation fields. */
  chiefComplaint: z.string().nullable(),
  signedAt: isoTimestampSchema.nullable(),
  signedBy: uuidSchema.nullable(),
  periodStart: isoTimestampSchema,
  periodEnd: isoTimestampSchema.nullable(),
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type EncounterResponse = z.infer<typeof encounterResponseSchema>;

/** Update the chief complaint while the encounter is still open (in_progress). */
export const updateEncounterRequestSchema = z.object({
  chiefComplaint: z.string().trim().min(1).max(1000),
});
export type UpdateEncounterRequest = z.infer<typeof updateEncounterRequestSchema>;

/**
 * Sign / finalize the encounter (Stage 5, Constitution — doctor-only, human).
 * Freezes documentation; post-sign changes require an amendment (DDR-0013).
 */
export const signEncounterRequestSchema = z.object({
  attestation: z.literal(true, {
    error: "Signing requires an explicit clinician attestation (Constitution)",
  }),
});
export type SignEncounterRequest = z.infer<typeof signEncounterRequestSchema>;
