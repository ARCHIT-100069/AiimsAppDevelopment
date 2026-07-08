/**
 * AI contracts (Stage 7, AI-ARCHITECTURE / AIDR). OPERATIONAL-ONLY by the
 * Constitution: suggestions are advisory, labelled, and NEVER auto-applied
 * (human-in-the-loop). The API surface exposes assistive capabilities only —
 * no diagnosis, no treatment, no autonomous decision, no write path.
 */
import { z } from "zod";
import { codingSchema } from "./coding";

/** The single operational capability shipped in Stage 7. */
export const AI_CAPABILITIES = ["coding_assist"] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];

/** The mandatory label on every AI output (AIDR-0010) — a literal, not free text. */
export const AI_LABEL = "AI-generated — verify" as const;

/**
 * Request an ICD-10 coding suggestion for clinical text. The text is
 * PHI-redacted before ANY model call (AIDR-0008); identifiers must not be sent.
 */
export const codingSuggestRequestSchema = z.object({
  /** The de-identifiable clinical text to code (e.g. an assessment/plan). */
  text: z.string().trim().min(1).max(4000),
});
export type CodingSuggestRequest = z.infer<typeof codingSuggestRequestSchema>;

export const codingSuggestionSchema = z.object({
  code: codingSchema,
  /** 0..1 model/heuristic confidence — advisory only. */
  confidence: z.number().min(0).max(1),
});
export type CodingSuggestion = z.infer<typeof codingSuggestionSchema>;

export const codingSuggestResponseSchema = z.object({
  capability: z.literal("coding_assist"),
  label: z.literal(AI_LABEL),
  suggestions: z.array(codingSuggestionSchema).max(10),
  /** True when PHI patterns were removed before the model call (AIDR-0008). */
  redactionApplied: z.boolean(),
  /** Provider that served the request ("mock" until credentials are supplied). */
  provider: z.string(),
  disclaimer: z.string(),
});
export type CodingSuggestResponse = z.infer<typeof codingSuggestResponseSchema>;
