/** @type {import('next').NextConfig} */

// Stage 9 hardening: baseline security headers on every response. The web app
// is a BFF that renders HTML + talks to Keycloak/the API, so — unlike the
// JSON API — it needs a CSP that permits its own scripts/styles while still
// denying framing, sniffing, and referrer leakage.
const ONE_YEAR = 31536000;
const securityHeaders = [
  { key: "Strict-Transport-Security", value: `max-age=${ONE_YEAR}; includeSubDomains; preload` },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

export default {
  // BFF pattern (SDR-0001): tokens live server-side; the browser never holds
  // long-lived secrets. Route handlers under app/api act as the BFF layer
  // when the frontend stage lands.
  reactStrictMode: true,
  poweredByHeader: false, // never reveal the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
