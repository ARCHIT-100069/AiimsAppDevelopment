/**
 * Clinical note contracts (Stage 5) — append-only versioned documentation
 * (DDR-0013). A note is created during an in-progress encounter; amending a
 * (signed) note inserts a NEW version that supersedes the prior one — prior
 * versions are immutable and retained. Small bodies are stored inline; large
 * bodies go to object storage via a presigned attachment (APDR-0007).
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const NOTE_TYPES = ["progress", "consult", "discharge"] as const;

/** Inline body cap; larger documents belong in an attachment. */
const bodySchema = z.string().trim().min(1).max(8000);

export const createNoteRequestSchema = z.object({
  noteType: z.enum(NOTE_TYPES).default("progress"),
  body: bodySchema,
});
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;

/** Amend a note (post-sign correction, DDR-0013) — creates a new version. */
export const amendNoteRequestSchema = z.object({
  body: bodySchema,
  reason: z.string().trim().min(1).max(500),
});
export type AmendNoteRequest = z.infer<typeof amendNoteRequestSchema>;

export const noteResponseSchema = z.object({
  id: uuidSchema,
  noteId: uuidSchema,
  encounterId: uuidSchema,
  version: z.number().int(),
  supersedesId: uuidSchema.nullable(),
  noteType: z.enum(NOTE_TYPES),
  body: z.string(),
  authorId: uuidSchema,
  status: z.enum(["active", "amended"]),
  amendmentReason: z.string().nullable(),
  createdAt: isoTimestampSchema,
});
export type NoteResponse = z.infer<typeof noteResponseSchema>;

export const listNotesResponseSchema = z.object({
  data: z.array(noteResponseSchema),
});
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
