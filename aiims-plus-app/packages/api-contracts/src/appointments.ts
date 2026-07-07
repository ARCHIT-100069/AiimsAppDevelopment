/**
 * Appointment contracts (Stage 4, Master Plan §14) — the ONLY shapes the
 * scheduling API exposes; database rows never cross this boundary. Times are
 * ISO-8601 UTC instants (stored `timestamptz`, DB §4); the client renders them
 * in the facility's timezone. Double-booking is prevented at the DB by a
 * `btree_gist` slot-exclusion constraint (DDR-0009), surfaced here as 409.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { listMetaSchema, listQuerySchema } from "./pagination";
import { specialtyCodingSchema } from "./practitioners";

/** OPD lifecycle. `booked|checked_in|in_progress` occupy the slot; the rest free it. */
export const APPOINTMENT_STATUSES = [
  "booked",
  "checked_in",
  "in_progress",
  "fulfilled",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = ["routine", "walk_in", "follow_up"] as const;

const instant = z.iso.datetime({ offset: true });
const reasonSchema = z.string().trim().min(1).max(500);
const prioritySchema = z.number().int().min(0).max(9);

export const createAppointmentRequestSchema = z
  .object({
    patientId: uuidSchema,
    practitionerId: uuidSchema,
    facilityId: uuidSchema,
    departmentId: uuidSchema.optional(),
    startAt: instant,
    endAt: instant,
    appointmentType: z.enum(APPOINTMENT_TYPES).default("routine"),
    specialties: z.array(specialtyCodingSchema).max(20).default([]),
    reasonText: reasonSchema.optional(),
    priority: prioritySchema.default(0),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
export type CreateAppointmentRequest = z.infer<typeof createAppointmentRequestSchema>;

/**
 * Reschedule / edit — status changes go through the dedicated cancel / no-show /
 * check-in endpoints, never here. At least one field required.
 */
export const updateAppointmentRequestSchema = z
  .object({
    startAt: instant.optional(),
    endAt: instant.optional(),
    departmentId: uuidSchema.nullish(),
    appointmentType: z.enum(APPOINTMENT_TYPES).optional(),
    specialties: z.array(specialtyCodingSchema).max(20).optional(),
    reasonText: reasonSchema.nullish(),
    priority: prioritySchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  })
  .refine((v) => !(v.startAt && v.endAt) || new Date(v.endAt) > new Date(v.startAt), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  });
export type UpdateAppointmentRequest = z.infer<typeof updateAppointmentRequestSchema>;

/** Optional structured cancellation reason (audited). */
export const cancelAppointmentRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type CancelAppointmentRequest = z.infer<typeof cancelAppointmentRequestSchema>;

export const appointmentResponseSchema = z.object({
  id: uuidSchema,
  patientId: uuidSchema,
  practitionerId: uuidSchema,
  facilityId: uuidSchema,
  departmentId: uuidSchema.nullable(),
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
  status: z.enum(APPOINTMENT_STATUSES),
  appointmentType: z.enum(APPOINTMENT_TYPES),
  specialties: z.array(specialtyCodingSchema),
  reasonText: z.string().nullable(),
  priority: z.number().int(),
  /** Optimistic-concurrency token — echo via If-Match on reschedule/cancel (APDR-0006). */
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;

/** POST /:id/check-in result: the appointment plus the opened encounter + queue token. */
export const checkInResponseSchema = appointmentResponseSchema.extend({
  encounterId: uuidSchema,
  queueToken: z.number().int(),
});
export type CheckInResponse = z.infer<typeof checkInResponseSchema>;

/**
 * Allow-listed search (APDR-0005): at most ONE of patient / practitioner /
 * department, optionally bounded by a date range (a schedule/day view).
 */
export const searchAppointmentsQuerySchema = listQuerySchema
  .extend({
    patientId: uuidSchema.optional(),
    practitionerId: uuidSchema.optional(),
    departmentId: uuidSchema.optional(),
    from: instant.optional(),
    to: instant.optional(),
  })
  .refine((v) => [v.patientId, v.practitionerId, v.departmentId].filter(Boolean).length <= 1, {
    message: "Use at most one of patientId, practitionerId, departmentId",
  })
  .refine((v) => !(v.from && v.to) || new Date(v.to) > new Date(v.from), {
    message: "to must be after from",
    path: ["to"],
  });
export type SearchAppointmentsQuery = z.infer<typeof searchAppointmentsQuerySchema>;

export const listAppointmentsResponseSchema = z.object({
  data: z.array(appointmentResponseSchema),
  meta: listMetaSchema,
});
export type ListAppointmentsResponse = z.infer<typeof listAppointmentsResponseSchema>;
