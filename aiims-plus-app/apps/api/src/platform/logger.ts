/**
 * Structured JSON logger (SDR-0010): correlation + tenant + actor ids, NEVER
 * PHI. Authorization headers and note bodies are redacted defensively; the
 * no-console ESLint rule forces all output through here.
 */
import pino from "pino";

export type AppLogger = pino.Logger;

export function createLogger(level: string): AppLogger {
  return pino({
    level,
    redact: {
      paths: ["req.headers.authorization", "*.authorization", "*.password", "*.body", "*.token"],
      censor: "[REDACTED]",
    },
    base: { service: "aiims-api" },
  });
}

export const LOGGER = Symbol("LOGGER");
