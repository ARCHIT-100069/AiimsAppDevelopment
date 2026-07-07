/**
 * Observation contracts (Stage 5) — vitals and simple measurements as FHIR
 * Observations (LOINC-coded, DDR-0005). Numeric value + unit, or a text value.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { codingSchema } from "./coding";

export const createObservationRequestSchema = z
  .object({
    code: codingSchema,
    valueNumeric: z.number().optional(),
    unit: z.string().trim().min(1).max(32).optional(),
    valueText: z.string().trim().min(1).max(500).optional(),
    effectiveAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((v) => v.valueNumeric !== undefined || v.valueText !== undefined, {
    message: "Provide valueNumeric (with unit) or valueText",
  });
export type CreateObservationRequest = z.infer<typeof createObservationRequestSchema>;

export const observationResponseSchema = z.object({
  id: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  code: codingSchema,
  valueNumeric: z.number().nullable(),
  unit: z.string().nullable(),
  valueText: z.string().nullable(),
  effectiveAt: isoTimestampSchema,
  recordedBy: uuidSchema,
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type ObservationResponse = z.infer<typeof observationResponseSchema>;

export const listObservationsResponseSchema = z.object({
  data: z.array(observationResponseSchema),
});
export type ListObservationsResponse = z.infer<typeof listObservationsResponseSchema>;
