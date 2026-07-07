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
  periodStart: isoTimestampSchema,
  periodEnd: isoTimestampSchema.nullable(),
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type EncounterResponse = z.infer<typeof encounterResponseSchema>;
