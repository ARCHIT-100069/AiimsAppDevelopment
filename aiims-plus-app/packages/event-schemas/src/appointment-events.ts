/**
 * Appointment + encounter domain events (Stage 4) — versioned outbox payloads
 * (DDR-0007). References and minimal fields only; never PHI (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const APPOINTMENT_BOOKED_V1 = "appointment.booked.v1" as const;
export const appointmentBookedV1PayloadSchema = z.object({
  appointmentId: uuidSchema,
  patientId: uuidSchema,
  practitionerId: uuidSchema,
});

export const APPOINTMENT_RESCHEDULED_V1 = "appointment.rescheduled.v1" as const;
export const appointmentRescheduledV1PayloadSchema = z.object({
  appointmentId: uuidSchema,
  version: z.number().int(),
});

export const APPOINTMENT_CANCELLED_V1 = "appointment.cancelled.v1" as const;
export const appointmentCancelledV1PayloadSchema = z.object({
  appointmentId: uuidSchema,
  version: z.number().int(),
});

export const APPOINTMENT_NO_SHOW_V1 = "appointment.no_show.v1" as const;
export const appointmentNoShowV1PayloadSchema = z.object({
  appointmentId: uuidSchema,
  version: z.number().int(),
});

export const APPOINTMENT_CHECKED_IN_V1 = "appointment.checked_in.v1" as const;
export const appointmentCheckedInV1PayloadSchema = z.object({
  appointmentId: uuidSchema,
  encounterId: uuidSchema,
  queueToken: z.number().int(),
});

export const ENCOUNTER_OPENED_V1 = "encounter.opened.v1" as const;
export const encounterOpenedV1PayloadSchema = z.object({
  encounterId: uuidSchema,
  appointmentId: uuidSchema,
  patientId: uuidSchema,
  practitionerId: uuidSchema,
});

export const APPOINTMENT_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [APPOINTMENT_BOOKED_V1]: appointmentBookedV1PayloadSchema,
  [APPOINTMENT_RESCHEDULED_V1]: appointmentRescheduledV1PayloadSchema,
  [APPOINTMENT_CANCELLED_V1]: appointmentCancelledV1PayloadSchema,
  [APPOINTMENT_NO_SHOW_V1]: appointmentNoShowV1PayloadSchema,
  [APPOINTMENT_CHECKED_IN_V1]: appointmentCheckedInV1PayloadSchema,
  [ENCOUNTER_OPENED_V1]: encounterOpenedV1PayloadSchema,
};
