/**
 * @aiims/config — typed application configuration (BDR-0011).
 *
 * All configuration is parsed and validated with Zod at boot; the process
 * fails fast on missing/invalid values. Secrets arrive via environment
 * injection (AWS Secrets Manager task-role injection in deployed envs,
 * .env for local dev) and are NEVER committed (SDR-0006).
 */
import { z } from "zod";

const adapterModeSchema = z.enum(["mock", "real"]).default("mock");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  /** Runtime connection — MUST be the `aiims_app` role (no BYPASSRLS, DDR-0003). */
  DATABASE_URL_APP: z.string().min(1),
  /** Migration connection — `aiims_migrator`/owner; used only by migrate/seed (DDR-0011). */
  DATABASE_URL_MIGRATOR: z.string().min(1).optional(),

  /** Redis for BullMQ fan-out (Blueprint §15). Optional in Stage 0 unit tests. */
  REDIS_URL: z.string().optional(),

  /** OIDC (Keycloak realm — ADR-0008/SDR-0001). */
  OIDC_ISSUER_URL: z.url(),
  OIDC_AUDIENCE: z.string().min(1).default("aiims-api"),
  /** Dev-only escape hatch for local JWKS over plain http. */
  OIDC_ALLOW_INSECURE_HTTP: z.coerce.boolean().default(false),

  /** Outbox dispatcher (DDR-0007/BDR-0005). */
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  /**
   * Adapter selection (ADR-0010/BDR-0008): every integration defaults to its
   * mock. "real" implementations are Production work behind these same seams.
   */
  ADAPTER_ABDM: adapterModeSchema,
  ADAPTER_CONSENT: adapterModeSchema,
  ADAPTER_PAYMENT: adapterModeSchema,
  ADAPTER_NOTIFICATION: adapterModeSchema,
  ADAPTER_AI: adapterModeSchema,

  /** Object storage (S3 in AWS; MinIO locally — IDR-0016). Unused until a stage needs it. */
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("ap-south-1"),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid configuration — refusing to boot (BDR-0011):\n${issues.join("\n")}`);
    this.name = "ConfigValidationError";
  }
}

/** Parse configuration from an env map; throws (fail-fast) on any problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigValidationError(
      result.error.issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }
  return result.data;
}

/** Feature-flag evaluation contract (ADR-0010). Backed by platform.feature_flag. */
export interface FeatureFlagReader {
  /** Per-tenant override wins over the global default (DB Arch §5). */
  isEnabled(key: string, tenantId?: string): Promise<boolean>;
}
