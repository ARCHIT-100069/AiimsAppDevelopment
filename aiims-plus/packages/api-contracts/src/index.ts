import { z } from "zod";
// Problem-Details error envelope (APDR-0003) — no PHI/stack traces.
export const Problem = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number(),
  code: z.string(),
  detail: z.string().optional(),
  correlationId: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof Problem>;

export const CreateNoteRequest = z.object({ body: z.string().min(1).max(4000) });
export type CreateNoteRequest = z.infer<typeof CreateNoteRequest>;
export const NoteResponse = z.object({ id: z.string().uuid(), body: z.string(), version: z.number() });
export type NoteResponse = z.infer<typeof NoteResponse>;
