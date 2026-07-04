import { z } from "zod";
// FHIR-aligned domain vocabulary (source of truth). Stage 0: minimal tenant + note + ids.
export const uuidSchema = z.string().uuid();
export type UUID = z.infer<typeof uuidSchema>;

export const TenantId = uuidSchema.brand<"TenantId">();
export type TenantId = z.infer<typeof TenantId>;

export const Note = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  body: z.string().min(1).max(4000),
  version: z.number().int().nonnegative(),
});
export type Note = z.infer<typeof Note>;
