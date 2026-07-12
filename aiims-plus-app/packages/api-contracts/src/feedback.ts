/**
 * Patient-feedback contracts (Zod). A patient rates their care (1–5) with an
 * optional category + free-text comment. Quality/NABH. DTO-only (BDR-0006).
 */
import { z } from "zod";

export const FEEDBACK_CATEGORIES = [
  "overall",
  "doctor",
  "nursing",
  "cleanliness",
  "billing",
  "facilities",
] as const;

export const createFeedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(FEEDBACK_CATEGORIES).default("overall"),
  comment: z.string().trim().max(2000).optional(),
  encounterId: z.uuid().optional(),
});
export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>;

export const feedbackResponseSchema = z.object({
  id: z.uuid(),
  rating: z.number().int(),
  category: z.string().nullable(),
  comment: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

export const listFeedbackResponseSchema = z.object({ data: z.array(feedbackResponseSchema) });
export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;
