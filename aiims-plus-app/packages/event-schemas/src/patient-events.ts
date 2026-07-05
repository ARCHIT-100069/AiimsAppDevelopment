/**
 * Patient domain events (Stage 2) — versioned outbox payloads (DDR-0007).
 * REFERENCES ONLY: never names, identifiers, or any PHI field (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const PATIENT_REGISTERED_V1 = "patient.registered.v1" as const;
export const patientRegisteredV1PayloadSchema = z.object({
  patientId: uuidSchema,
});

export const PATIENT_UPDATED_V1 = "patient.updated.v1" as const;
export const patientUpdatedV1PayloadSchema = z.object({
  patientId: uuidSchema,
  version: z.number().int(),
});

export const PATIENT_ABHA_LINKED_V1 = "patient.abha_linked.v1" as const;
export const patientAbhaLinkedV1PayloadSchema = z.object({
  patientId: uuidSchema,
  provider: z.enum(["mock", "abdm"]),
});

export const PATIENT_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [PATIENT_REGISTERED_V1]: patientRegisteredV1PayloadSchema,
  [PATIENT_UPDATED_V1]: patientUpdatedV1PayloadSchema,
  [PATIENT_ABHA_LINKED_V1]: patientAbhaLinkedV1PayloadSchema,
};
