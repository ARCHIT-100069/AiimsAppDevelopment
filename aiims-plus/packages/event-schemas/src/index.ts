import { z } from "zod";
export const NoteCreatedV1 = z.object({
  type: z.literal("note.created.v1"),
  tenantId: z.string().uuid(),
  noteId: z.string().uuid(),
  occurredAt: z.string(),
});
export type NoteCreatedV1 = z.infer<typeof NoteCreatedV1>;
export type DomainEvent = NoteCreatedV1;
