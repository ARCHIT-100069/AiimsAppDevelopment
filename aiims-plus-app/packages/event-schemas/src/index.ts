/**
 * @aiims/event-schemas — versioned outbox event contracts (DDR-0007, BDR-0005).
 *
 * Every outbox payload conforms to a schema registered here. Event types are
 * versioned (`<aggregate>.<action>.v<N>`); a breaking payload change is a new
 * version, never an in-place edit — this is what makes the future
 * monolith→services split mechanical (ADR-0001).
 *
 * Payloads carry REFERENCES and minimal fields only — never raw PHI (SDR-0004).
 */
import { uuidSchema, isoTimestampSchema } from "@aiims/domain-types";
import { z } from "zod";

/** The envelope every outbox row's logical event conforms to (DB Arch §6). */
export const eventEnvelopeSchema = z.object({
  /** UUIDv7 event id — generated with the business write (DDR-0001). */
  id: uuidSchema,
  tenantId: uuidSchema,
  aggregateType: z.string().min(1),
  aggregateId: uuidSchema,
  eventType: z
    .string()
    .regex(/^[a-z_]+\.[a-z_]+\.v\d+$/, "event types are versioned: <aggregate>.<action>.v<N>"),
  occurredAt: isoTimestampSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

import { PLATFORM_EVENT_SCHEMAS } from "./platform-events";
import { PATIENT_EVENT_SCHEMAS } from "./patient-events";
import { PRACTITIONER_EVENT_SCHEMAS } from "./practitioner-events";

export * from "./platform-events";
export * from "./patient-events";
export * from "./practitioner-events";

/** Registry mapping event type → payload schema; consumers validate against this. */
export const EVENT_PAYLOAD_SCHEMAS: Record<string, z.ZodType> = {
  ...PLATFORM_EVENT_SCHEMAS,
  ...PATIENT_EVENT_SCHEMAS,
  ...PRACTITIONER_EVENT_SCHEMAS,
};

/** Validate a full envelope including its type-specific payload. */
export function parseEvent(input: unknown): EventEnvelope {
  const envelope = eventEnvelopeSchema.parse(input);
  const payloadSchema = EVENT_PAYLOAD_SCHEMAS[envelope.eventType];
  if (!payloadSchema) {
    throw new Error(`Unknown event type "${envelope.eventType}" — register its schema first.`);
  }
  payloadSchema.parse(envelope.payload);
  return envelope;
}
