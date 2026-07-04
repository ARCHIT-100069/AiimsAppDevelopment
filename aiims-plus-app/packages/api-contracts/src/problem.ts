/**
 * RFC 9457 Problem Details error contract (APDR-0003, BDR-0010).
 *
 * Every error response uses this shape. `detail` is always safe text —
 * NEVER PHI, secrets, or stack traces (SDR-0009/0010); 5xx responses carry
 * only a generic message plus the correlation id.
 */
import { z } from "zod";

/** Stable machine-readable error codes (BDR-0010 taxonomy → HTTP mapping). */
export const ERROR_CODES = {
  VALIDATION_FAILED: { status: 422, title: "Validation failed" },
  UNAUTHENTICATED: { status: 401, title: "Authentication required" },
  FORBIDDEN: { status: 403, title: "Not permitted" },
  NOT_FOUND: { status: 404, title: "Resource not found" },
  CONFLICT: { status: 409, title: "Conflict" },
  RATE_LIMITED: { status: 429, title: "Too many requests" },
  INTEGRATION_UNAVAILABLE: { status: 503, title: "Dependency unavailable" },
  INTERNAL: { status: 500, title: "Internal error" },
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const problemDetailsSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  correlationId: z.string(),
  errors: z.array(fieldErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
