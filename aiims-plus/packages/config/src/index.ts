import { z } from "zod";
const Schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL_APP: z.string().url(),           // connects as aiims_app (RLS enforced)
  OIDC_ISSUER: z.string().url().optional(),      // Keycloak realm issuer (prod)
  OIDC_AUDIENCE: z.string().optional(),
  DEV_AUTH: z.coerce.boolean().default(true),    // dev-only header auth (Stage 0)
});
export type AppConfig = z.infer<typeof Schema>;
export function loadConfig(env = process.env): AppConfig {
  const r = Schema.safeParse(env);
  if (!r.success) { throw new Error("Invalid config: " + JSON.stringify(r.error.flatten().fieldErrors)); }
  return r.data; // fail-fast on invalid/missing config (BDR-0011)
}
