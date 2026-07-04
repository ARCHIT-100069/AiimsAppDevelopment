/**
 * Stage 0 walking-skeleton proof contract: /v1/notes.
 *
 * This is NOT a clinical feature. It exists solely to prove the platform
 * pipeline end-to-end (authN → tenant context → authZ → validated write →
 * outbox → audit) per IMPLEMENTATION-MASTER-PLAN §10. It is removed when the
 * first real module lands in Stage 1.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const createNoteRequestSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;

export const noteResponseSchema = z.object({
  id: uuidSchema,
  body: z.string(),
  createdAt: isoTimestampSchema,
});
export type NoteResponse = z.infer<typeof noteResponseSchema>;

export const listNotesResponseSchema = z.object({
  data: z.array(noteResponseSchema),
  meta: z.object({
    /** Cursor pagination per APDR-0005; single page in Stage 0. */
    nextCursor: z.string().nullable(),
  }),
});
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
