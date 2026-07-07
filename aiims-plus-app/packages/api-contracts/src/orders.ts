/**
 * Order + result contracts (Stage 5) — FHIR ServiceRequest (lab/imaging order)
 * and DiagnosticReport (result). A result references its order; results may
 * carry a large attachment via a presigned object (APDR-0007).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { codingSchema } from "./coding";

export const ORDER_PRIORITIES = ["routine", "urgent", "stat"] as const;
export const ORDER_STATUSES = ["active", "completed", "revoked"] as const;
export const REPORT_STATUSES = ["preliminary", "final"] as const;

export const createOrderRequestSchema = z.object({
  code: codingSchema,
  priority: z.enum(ORDER_PRIORITIES).default("routine"),
  note: z.string().trim().min(1).max(1000).optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const orderResponseSchema = z.object({
  id: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  code: codingSchema,
  intent: z.literal("order"),
  status: z.enum(ORDER_STATUSES),
  priority: z.enum(ORDER_PRIORITIES),
  note: z.string().nullable(),
  requesterId: uuidSchema,
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const listOrdersResponseSchema = z.object({
  data: z.array(orderResponseSchema),
});
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;

export const createResultRequestSchema = z.object({
  status: z.enum(REPORT_STATUSES).default("final"),
  conclusion: z.string().trim().min(1).max(4000),
  /** Optional registered attachment (presigned upload already completed). */
  attachmentId: uuidSchema.optional(),
});
export type CreateResultRequest = z.infer<typeof createResultRequestSchema>;

export const resultResponseSchema = z.object({
  id: uuidSchema,
  serviceRequestId: uuidSchema,
  encounterId: uuidSchema,
  patientId: uuidSchema,
  status: z.enum(REPORT_STATUSES),
  conclusion: z.string(),
  attachmentId: uuidSchema.nullable(),
  issuedAt: isoTimestampSchema,
  filedBy: uuidSchema,
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type ResultResponse = z.infer<typeof resultResponseSchema>;

export const listResultsResponseSchema = z.object({
  data: z.array(resultResponseSchema),
});
export type ListResultsResponse = z.infer<typeof listResultsResponseSchema>;
