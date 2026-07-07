/**
 * Practitioner availability templates + computed bookable slots (Stage 4,
 * decision D-4.2). Templates are recurring weekly windows; slots are COMPUTED
 * on demand (template minus active appointments) — never materialised — so the
 * DB slot-exclusion constraint stays the single source of truth for conflicts.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

/** 0 = Sunday … 6 = Saturday (matches Postgres `extract(dow …)`). */
const dayOfWeekSchema = z.number().int().min(0).max(6);
/** Local wall-clock "HH:MM" in the facility timezone. */
const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM (24h)");
const slotMinutesSchema = z.number().int().min(5).max(240);

export const createAvailabilityRequestSchema = z
  .object({
    practitionerId: uuidSchema,
    facilityId: uuidSchema,
    dayOfWeek: dayOfWeekSchema,
    startTime: localTimeSchema,
    endTime: localTimeSchema,
    slotMinutes: slotMinutesSchema,
    validFrom: z.iso.date().optional(),
    validUntil: z.iso.date().optional(),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });
export type CreateAvailabilityRequest = z.infer<typeof createAvailabilityRequestSchema>;

export const availabilityResponseSchema = z.object({
  id: uuidSchema,
  practitionerId: uuidSchema,
  facilityId: uuidSchema,
  dayOfWeek: z.number().int(),
  startTime: z.string(),
  endTime: z.string(),
  slotMinutes: z.number().int(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

export const listAvailabilityResponseSchema = z.object({
  data: z.array(availabilityResponseSchema),
});
export type ListAvailabilityResponse = z.infer<typeof listAvailabilityResponseSchema>;

/** Query the free slots for a practitioner on a given calendar date. */
export const slotsQuerySchema = z.object({
  date: z.iso.date(),
});
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;

export const slotSchema = z.object({
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
});
export type Slot = z.infer<typeof slotSchema>;

export const slotsResponseSchema = z.object({
  practitionerId: uuidSchema,
  date: z.string(),
  slots: z.array(slotSchema),
});
export type SlotsResponse = z.infer<typeof slotsResponseSchema>;
