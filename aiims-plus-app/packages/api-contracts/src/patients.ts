/**
 * Patient contracts (Stage 2, Master Plan §12) — the ONLY shapes the API
 * exposes; database rows never cross this boundary. Identifiers (phone,
 * email, ABHA) are encrypted at rest (DDR-0006) and returned decrypted only
 * to authorized principals over TLS.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { listMetaSchema, listQuerySchema } from "./pagination";

/** FHIR administrative-gender value set (DDR-0005 promoted column). */
export const GENDERS = ["male", "female", "other", "unknown"] as const;

/** Required on unsafe POSTs (APDR-0006) — replays return the original resource. */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

const nameSchema = z.string().trim().min(1).max(120);
/** E.164-ish; normalized before encryption/blind-indexing (packages/crypto). */
const phoneSchema = z.string().regex(/^\+?[0-9][0-9 -]{6,18}[0-9]$/, "phone number");
const emailSchema = z.email().max(254);
const abhaAddressSchema = z
  .string()
  .regex(/^[a-z0-9._]{3,60}@[a-z0-9]+$/i, "ABHA address, e.g. name@abdm");
const birthDateSchema = z.iso.date();

export const createPatientRequestSchema = z
  .object({
    nameGiven: nameSchema,
    nameFamily: nameSchema,
    gender: z.enum(GENDERS),
    birthDate: birthDateSchema,
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    address: z.record(z.string(), z.unknown()).optional(),
    /** Link an existing ABHA (mock-verified in MVP — ADR-0006 M1). */
    abhaAddress: abhaAddressSchema.optional(),
    /** Or ask the (mock) ABDM gateway to create one. */
    requestAbha: z.boolean().default(false),
  })
  .refine((v) => !(v.abhaAddress && v.requestAbha), {
    message: "Provide abhaAddress OR requestAbha, not both",
    path: ["requestAbha"],
  });
export type CreatePatientRequest = z.infer<typeof createPatientRequestSchema>;

export const updatePatientRequestSchema = z
  .object({
    nameGiven: nameSchema.optional(),
    nameFamily: nameSchema.optional(),
    gender: z.enum(GENDERS).optional(),
    birthDate: birthDateSchema.optional(),
    phone: phoneSchema.nullish(),
    email: emailSchema.nullish(),
    address: z.record(z.string(), z.unknown()).nullish(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  });
export type UpdatePatientRequest = z.infer<typeof updatePatientRequestSchema>;

export const patientResponseSchema = z.object({
  id: uuidSchema,
  mrn: z.string(),
  nameGiven: z.string(),
  nameFamily: z.string(),
  gender: z.enum(GENDERS),
  birthDate: birthDateSchema,
  phone: z.string().nullable(),
  email: z.string().nullable(),
  abhaAddress: z.string().nullable(),
  abhaNumber: z.string().nullable(),
  address: z.record(z.string(), z.unknown()).nullable(),
  /** Optimistic-concurrency token — echo via If-Match on PATCH (APDR-0006). */
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type PatientResponse = z.infer<typeof patientResponseSchema>;

/**
 * Allow-listed search (APDR-0005): free text (name via trigram, MRN prefix)
 * OR one exact identifier resolved via blind index (never decryption).
 */
export const searchPatientsQuerySchema = listQuerySchema
  .extend({
    q: z.string().trim().min(1).max(120).optional(),
    mrn: z.string().trim().min(1).max(32).optional(),
    phone: phoneSchema.optional(),
    abha: z.string().trim().min(6).max(20).optional(),
  })
  .refine((v) => [v.q, v.mrn, v.phone, v.abha].filter(Boolean).length <= 1, {
    message: "Use at most one of q, mrn, phone, abha",
  });
export type SearchPatientsQuery = z.infer<typeof searchPatientsQuerySchema>;

export const listPatientsResponseSchema = z.object({
  data: z.array(patientResponseSchema),
  meta: listMetaSchema,
});
export type ListPatientsResponse = z.infer<typeof listPatientsResponseSchema>;
