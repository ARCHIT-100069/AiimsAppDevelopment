import { z } from "zod";

/** Public, unauthenticated (APDR-0011: health is the only public surface). */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
