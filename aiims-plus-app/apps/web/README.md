# @aiims/web — Next.js web application (FEDR-0001)

**Stage 0 scaffold.** Builds and serves a placeholder page + `/api/healthz`. The clinical UI is
built in the frontend stage against the frozen contracts:

- **BFF pattern (SDR-0001):** tokens live in httpOnly cookie sessions server-side — the browser
  never holds long-lived secrets. BFF route handlers live under `app/api/`.
- Typed client generated from `@aiims/api-contracts` (FEDR-0006); TanStack Query + Zustand
  (FEDR-0005); RHF + the same Zod schemas the API validates with (FEDR-0011).
- Design system from `@aiims/ui-web` + `@aiims/design-tokens`; WCAG 2.1 AA target (FEDR-0004).
- **No business logic in the client; no PHI in browser storage** (Blueprint §8).
