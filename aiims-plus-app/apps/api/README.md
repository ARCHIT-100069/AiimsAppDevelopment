# @aiims/api — NestJS modular monolith (ADR-0001)

The core system. Stage 0 ships the platform skeleton; domain modules land stage by stage.

## Request pipeline (fixed — BDR-0012)

```
request → correlation-id middleware → AuthN guard (Keycloak JWKS, SDR-0001)
        → AuthZ guard (PEP → @aiims/authz PDP, SDR-0002)
        → Zod validation (api-contracts) → controller
        → application service  ←— THE transaction boundary (BDR-0004):
              one tenant-scoped tx = business write + outbox event + audit row
        → response  |  on error → Problem-Details filter (no PHI/stack, APDR-0003)
```

## Layout (BDR-0001/0002 — enforced by lint, violations fail CI)

```
src/
  platform/   config · logger (no-PHI) · UoW/tenant-context · auth/authz guards
              event bus · outbox dispatcher · audit · feature flags · health · errors filter
  adapters/   five ports (ABDM/consent/payment/notification/AI) + mocks (BDR-0008)
  modules/
    note/     Stage 0 proof module — REMOVED at Stage 1
      api/ application/ domain/ ports/ infrastructure/
```

Rules: the domain layer imports no framework/ORM/HTTP; modules never import another module's
internals; Drizzle exists only in `packages/db` — repositories call its typed helpers.

## Run

See the monorepo [README](../../README.md) for the full local bring-up. Quick reference:

```bash
pnpm build && pnpm --filter @aiims/api start   # needs compose up + migrate + seed + .env
```
