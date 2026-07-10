/**
 * Pharmacy domain events — versioned outbox payloads (DDR-0007). References and
 * minimal fields only; never PHI (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const PRESCRIPTION_WRITTEN_V1 = "prescription.written.v1" as const;
export const prescriptionWrittenV1PayloadSchema = z.object({
  prescriptionId: uuidSchema,
  patientId: uuidSchema,
  prescriberId: uuidSchema,
  itemCount: z.number().int(),
});

export const MEDICATION_DISPENSED_V1 = "medication.dispensed.v1" as const;
export const medicationDispensedV1PayloadSchema = z.object({
  dispenseId: uuidSchema,
  prescriptionId: uuidSchema,
  patientId: uuidSchema,
});

export const PHARMACY_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [PRESCRIPTION_WRITTEN_V1]: prescriptionWrittenV1PayloadSchema,
  [MEDICATION_DISPENSED_V1]: medicationDispensedV1PayloadSchema,
};
