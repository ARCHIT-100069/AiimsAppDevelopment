/**
 * Practitioner contracts (Stage 3, Master Plan §13) — the clinical profile
 * layered over an existing app_user (decision a). DTO-only; DB rows never
 * cross this boundary. Registration number is a professional credential,
 * NOT patient PHI, so it is not encrypted (decision d).
 */
import { isoTimestampSchema, ROLE_CODES, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { listMetaSchema, listQuerySchema } from "./pagination";

const nameSchema = z.string().trim().min(1).max(120);
/** Medical-council registration — tenant-unique (duplicate-safe → 409). */
const registrationSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9/-]+$/, "letters, digits, / or -");

/** A specialty coding (CodeableConcept element) from the reference system (DDR-0012). */
export const specialtyCodingSchema = z.object({
  system: z.string().min(1),
  code: z.string().min(1),
  display: z.string().min(1),
});
export type SpecialtyCoding = z.infer<typeof specialtyCodingSchema>;

/** Structured, non-blocking warnings returned from a mutation (decision i). */
export const practitionerWarningSchema = z.object({
  code: z.enum(["LINKED_USER_NOT_CLINICAL"]),
  message: z.string(),
});
export type PractitionerWarning = z.infer<typeof practitionerWarningSchema>;

export const createPractitionerRequestSchema = z.object({
  /** Existing app_user this profile belongs to — IMMUTABLE after creation. */
  appUserId: uuidSchema,
  registrationNo: registrationSchema,
  departmentId: uuidSchema.optional(),
  specialties: z.array(specialtyCodingSchema).max(20).default([]),
  /** Optional overrides; default to the linked user's display name (decision c). */
  nameGiven: nameSchema.optional(),
  nameFamily: nameSchema.optional(),
});
export type CreatePractitionerRequest = z.infer<typeof createPractitionerRequestSchema>;

/**
 * Update — note there is NO appUserId field: the link to the login is
 * immutable (founder requirement). Names/department/specialties/status only.
 */
export const updatePractitionerRequestSchema = z
  .object({
    nameGiven: nameSchema.optional(),
    nameFamily: nameSchema.optional(),
    departmentId: uuidSchema.nullish(),
    specialties: z.array(specialtyCodingSchema).max(20).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  });
export type UpdatePractitionerRequest = z.infer<typeof updatePractitionerRequestSchema>;

export const practitionerResponseSchema = z.object({
  id: uuidSchema,
  appUserId: uuidSchema,
  nameGiven: z.string(),
  nameFamily: z.string(),
  registrationNo: z.string(),
  departmentId: uuidSchema.nullable(),
  specialties: z.array(specialtyCodingSchema),
  status: z.enum(["active", "inactive"]),
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type PractitionerResponse = z.infer<typeof practitionerResponseSchema>;

/** POST result: the resource plus any non-blocking warnings (decision i). */
export const createPractitionerResponseSchema = practitionerResponseSchema.extend({
  warnings: z.array(practitionerWarningSchema).default([]),
});
export type CreatePractitionerResponse = z.infer<typeof createPractitionerResponseSchema>;

/** Allow-listed search (APDR-0005): free text (name) OR registration OR department.
 *  `role` is a separate eligibility filter (not part of that mutual-exclusion
 *  group) — e.g. `?role=doctor` for a booking picker that must never offer a
 *  nurse or front-desk practitioner profile alongside physicians. */
export const searchPractitionersQuerySchema = listQuerySchema
  .extend({
    q: z.string().trim().min(1).max(120).optional(),
    registrationNo: z.string().trim().min(1).max(40).optional(),
    departmentId: uuidSchema.optional(),
    role: z.enum(ROLE_CODES).optional(),
  })
  .refine((v) => [v.q, v.registrationNo, v.departmentId].filter(Boolean).length <= 1, {
    message: "Use at most one of q, registrationNo, departmentId",
  });
export type SearchPractitionersQuery = z.infer<typeof searchPractitionersQuerySchema>;

export const listPractitionersResponseSchema = z.object({
  data: z.array(practitionerResponseSchema),
  meta: listMetaSchema,
});
export type ListPractitionersResponse = z.infer<typeof listPractitionersResponseSchema>;
