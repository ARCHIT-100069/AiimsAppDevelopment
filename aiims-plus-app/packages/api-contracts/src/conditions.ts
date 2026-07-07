/**
 * Condition contracts (Stage 5) — diagnoses/problems as FHIR Conditions
 * (ICD-10 / SNOMED-coded, DDR-0005).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { codingSchema } from "./coding";

export const CONDITION_CATEGORIES = ["diagnosis", "problem"] as const;
export const CONDITION_CLINICAL_STATUSES = ["active", "resolved"] as const;

export const createConditionRequestSchema = z.object({
  code: codingSchema,
  category: z.enum(CONDITION_CATEGORIES).default("diagnosis"),
  clinicalStatus: z.enum(CONDITION_CLINICAL_STATUSES).default("active"),
  note: z.string().trim().min(1).max(1000).optional(),
});
export type CreateConditionRequest = z.infer<typeof createConditionRequestSchema>;

export const conditionResponseSchema = z.object({
  id: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  code: codingSchema,
  category: z.enum(CONDITION_CATEGORIES),
  clinicalStatus: z.enum(CONDITION_CLINICAL_STATUSES),
  note: z.string().nullable(),
  recordedBy: uuidSchema,
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type ConditionResponse = z.infer<typeof conditionResponseSchema>;

export const listConditionsResponseSchema = z.object({
  data: z.array(conditionResponseSchema),
});
export type ListConditionsResponse = z.infer<typeof listConditionsResponseSchema>;
