/**
 * Baseline security response headers (Stage 9 hardening, SDR-0001 posture).
 *
 * The API returns JSON only and is never framed or embedded, so the policy is
 * maximally restrictive. PHI must never be cached by intermediaries or the
 * browser, hence `Cache-Control: no-store`. HSTS is emitted for the TLS-
 * terminating edge; it is inert over plain HTTP in local dev.
 *
 * Dependency-free on purpose (no helmet) so the headers are auditable in one
 * place and add no supply-chain surface.
 */
import type { NextFunction, Request, Response } from "express";

const ONE_YEAR_SECONDS = 31_536_000;

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Never reveal the framework/runtime.
  res.removeHeader("X-Powered-By");

  // Force HTTPS at the edge for a year, including subdomains (preload-eligible).
  res.setHeader(
    "Strict-Transport-Security",
    `max-age=${ONE_YEAR_SECONDS}; includeSubDomains; preload`,
  );

  // MIME-sniffing / clickjacking / referrer leakage.
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  // A JSON API needs no privileged browser features; lock them all off.
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  );

  // Strict CSP for a non-HTML endpoint: nothing may load, nobody may frame us.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );

  // Cross-origin isolation.
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // PHI must not be cached anywhere (APDR / DPDP data-minimisation).
  res.setHeader("Cache-Control", "no-store");

  next();
}
