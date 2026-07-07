/**
 * OPD waiting queue (Stage 4, decision D-4.3). The queue is a QUERY over
 * checked-in / in-progress appointments — not a separate table — ordered by
 * priority then token, so there is a single source of truth. Reads are audited
 * like other clinical list reads.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const queueQuerySchema = z.object({
  facilityId: uuidSchema,
  departmentId: uuidSchema.optional(),
  /** Service date (facility-local); defaults to today when omitted. */
  date: z.iso.date().optional(),
});
export type QueueQuery = z.infer<typeof queueQuerySchema>;

export const queueEntrySchema = z.object({
  appointmentId: uuidSchema,
  patientId: uuidSchema,
  patientName: z.string().nullable(),
  practitionerId: uuidSchema,
  practitionerName: z.string().nullable(),
  queueToken: z.number().int(),
  /** 1-based live position within the ordered queue. */
  position: z.number().int(),
  priority: z.number().int(),
  status: z.enum(["checked_in", "in_progress"]),
  startAt: isoTimestampSchema,
  checkedInAt: isoTimestampSchema,
});
export type QueueEntry = z.infer<typeof queueEntrySchema>;

export const queueResponseSchema = z.object({
  facilityId: uuidSchema,
  departmentId: uuidSchema.nullable(),
  date: z.string(),
  entries: z.array(queueEntrySchema),
});
export type QueueResponse = z.infer<typeof queueResponseSchema>;
