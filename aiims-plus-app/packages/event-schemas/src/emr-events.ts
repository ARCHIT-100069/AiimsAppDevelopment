/**
 * EMR domain events (Stage 5) — versioned outbox payloads (DDR-0007).
 * References and minimal fields only; never clinical content or PHI (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const ENCOUNTER_SIGNED_V1 = "encounter.signed.v1" as const;
export const encounterSignedV1PayloadSchema = z.object({
  encounterId: uuidSchema,
  signedBy: uuidSchema,
  version: z.number().int(),
});

export const CLINICAL_NOTE_CREATED_V1 = "clinical_note.created.v1" as const;
export const clinicalNoteCreatedV1PayloadSchema = z.object({
  noteId: uuidSchema,
  encounterId: uuidSchema,
});

export const CLINICAL_NOTE_AMENDED_V1 = "clinical_note.amended.v1" as const;
export const clinicalNoteAmendedV1PayloadSchema = z.object({
  noteId: uuidSchema,
  encounterId: uuidSchema,
  version: z.number().int(),
});

export const OBSERVATION_RECORDED_V1 = "observation.recorded.v1" as const;
export const observationRecordedV1PayloadSchema = z.object({
  observationId: uuidSchema,
  encounterId: uuidSchema,
});

export const CONDITION_RECORDED_V1 = "condition.recorded.v1" as const;
export const conditionRecordedV1PayloadSchema = z.object({
  conditionId: uuidSchema,
  encounterId: uuidSchema,
});

export const SERVICE_REQUEST_PLACED_V1 = "service_request.placed.v1" as const;
export const serviceRequestPlacedV1PayloadSchema = z.object({
  serviceRequestId: uuidSchema,
  encounterId: uuidSchema,
});

export const DIAGNOSTIC_REPORT_FILED_V1 = "diagnostic_report.filed.v1" as const;
export const diagnosticReportFiledV1PayloadSchema = z.object({
  diagnosticReportId: uuidSchema,
  serviceRequestId: uuidSchema,
  encounterId: uuidSchema,
});

export const EMR_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [ENCOUNTER_SIGNED_V1]: encounterSignedV1PayloadSchema,
  [CLINICAL_NOTE_CREATED_V1]: clinicalNoteCreatedV1PayloadSchema,
  [CLINICAL_NOTE_AMENDED_V1]: clinicalNoteAmendedV1PayloadSchema,
  [OBSERVATION_RECORDED_V1]: observationRecordedV1PayloadSchema,
  [CONDITION_RECORDED_V1]: conditionRecordedV1PayloadSchema,
  [SERVICE_REQUEST_PLACED_V1]: serviceRequestPlacedV1PayloadSchema,
  [DIAGNOSTIC_REPORT_FILED_V1]: diagnosticReportFiledV1PayloadSchema,
};
