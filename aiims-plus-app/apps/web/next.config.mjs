/** @type {import('next').NextConfig} */

// Stage 9 hardening: baseline security headers on every response. The web app
// is a BFF that renders HTML + talks to Keycloak/the API, so — unlike the
// JSON API — it needs a CSP that permits its own scripts/styles while still
// denying framing, sniffing, and referrer leakage.
const ONE_YEAR = 31536000;
const isDev = process.env.NODE_ENV !== "production";
// Next.js injects inline bootstrap/hydration scripts (self.__next_f, RSC
// payload). A bare `script-src 'self'` blocks them, so the app renders but never
// hydrates (dead buttons). Allow inline scripts; in dev Turbopack also needs
// eval + a websocket for HMR. Production hardening path: a per-request nonce via
// middleware — for now the sensitive JSON surface (the API) keeps its strict CSP.
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;
const connectSrc = `connect-src 'self'${isDev ? " ws: http:" : ""}`;
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
      scriptSrc,
      connectSrc,
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
