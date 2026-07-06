/**
 * Practitioner domain events (Stage 3) — versioned outbox payloads (DDR-0007).
 * References only; no personal fields (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const PRACTITIONER_CREATED_V1 = "practitioner.created.v1" as const;
export const practitionerCreatedV1PayloadSchema = z.object({
  practitionerId: uuidSchema,
  appUserId: uuidSchema,
});

export const PRACTITIONER_UPDATED_V1 = "practitioner.updated.v1" as const;
export const practitionerUpdatedV1PayloadSchema = z.object({
  practitionerId: uuidSchema,
  version: z.number().int(),
});

/**
 * Emitted when a practitioner is created for an app_user that lacks a clinical
 * role (decision i): non-blocking, but recorded as its own event + audit row.
 */
export const PRACTITIONER_ROLE_WARNING_V1 = "practitioner.role_warning.v1" as const;
export const practitionerRoleWarningV1PayloadSchema = z.object({
  practitionerId: uuidSchema,
  appUserId: uuidSchema,
});

export const PRACTITIONER_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [PRACTITIONER_CREATED_V1]: practitionerCreatedV1PayloadSchema,
  [PRACTITIONER_UPDATED_V1]: practitionerUpdatedV1PayloadSchema,
  [PRACTITIONER_ROLE_WARNING_V1]: practitionerRoleWarningV1PayloadSchema,
};
