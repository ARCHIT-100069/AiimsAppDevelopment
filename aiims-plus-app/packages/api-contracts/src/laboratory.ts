/**
 * Laboratory contracts (Zod). A facility-wide worklist of lab orders and the
 * result a lab files against an order: a free-text conclusion plus structured
 * analyte lines (test, value, unit, reference range, high/low/critical flag).
 * DTO-only boundary (BDR-0006).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const LAB_RESULT_FLAGS = ["normal", "high", "low", "critical"] as const;

export const labWorklistItemSchema = z.object({
  orderId: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  patientName: z.string(),
  code: z.string(),
  codeSystem: z.string(),
  display: z.string(),
  priority: z.enum(["routine", "urgent", "stat"]),
  orderStatus: z.enum(["active", "completed", "revoked"]),
  orderedAt: isoTimestampSchema,
  reportId: uuidSchema.nullable(),
  reportStatus: z.enum(["preliminary", "final"]).nullable(),
  conclusion: z.string().nullable(),
  issuedAt: isoTimestampSchema.nullable(),
});
export type LabWorklistItem = z.infer<typeof labWorklistItemSchema>;

export const listLabWorklistResponseSchema = z.object({ data: z.array(labWorklistItemSchema) });
export type ListLabWorklistResponse = z.infer<typeof listLabWorklistResponseSchema>;

export const labResultLineInputSchema = z.object({
  analyte: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(40).optional(),
  referenceRange: z.string().trim().max(80).optional(),
  flag: z.enum(LAB_RESULT_FLAGS).default("normal"),
});
export type LabResultLineInput = z.infer<typeof labResultLineInputSchema>;

export const fileLabResultRequestSchema = z.object({
  status: z.enum(["preliminary", "final"]).default("final"),
  conclusion: z.string().trim().min(1).max(4000),
  lines: z.array(labResultLineInputSchema).max(100).default([]),
});
export type FileLabResultRequest = z.infer<typeof fileLabResultRequestSchema>;

export const labResultLineSchema = z.object({
  id: uuidSchema,
  analyte: z.string(),
  value: z.string(),
  unit: z.string().nullable(),
  referenceRange: z.string().nullable(),
  flag: z.enum(LAB_RESULT_FLAGS),
});
export type LabResultLine = z.infer<typeof labResultLineSchema>;

export const labResultResponseSchema = z.object({
  reportId: uuidSchema,
  orderId: uuidSchema,
  status: z.enum(["preliminary", "final"]),
  conclusion: z.string(),
  lines: z.array(labResultLineSchema),
  issuedAt: isoTimestampSchema,
});
export type LabResultResponse = z.infer<typeof labResultResponseSchema>;
