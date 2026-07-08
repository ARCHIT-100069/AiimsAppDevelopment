/**
 * AI domain events (Stage 7, AIDR-0011) — versioned outbox payloads (DDR-0007).
 * References + capability only; NEVER prompt/response content or PHI (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const AI_SUGGESTION_GENERATED_V1 = "ai.suggestion_generated.v1" as const;
export const aiSuggestionGeneratedV1PayloadSchema = z.object({
  requestId: uuidSchema,
  capability: z.string(),
  provider: z.string(),
});

export const AI_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [AI_SUGGESTION_GENERATED_V1]: aiSuggestionGeneratedV1PayloadSchema,
};
