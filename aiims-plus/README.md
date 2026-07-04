# AIIMS+ — Application Monorepo (Stage 0: Walking Skeleton)

Implements **Stage 0** of `IMPLEMENTATION-MASTER-PLAN.md` on the frozen architecture. No Stage 1 code.

## What Stage 0 delivers
- **Monorepo** (pnpm workspaces + Turborepo) with dependency-inward ESLint boundaries (BDR-0013).
- **`packages/db`** — Drizzle schema (`platform`, `audit`), hand-written **RLS migration** (`FORCE`,
  fail-closed, WITH CHECK), least-privilege **`aiims_app`** role (no BYPASSRLS), and the transaction-scoped
  **tenant-context** helper (`SET LOCAL`) — DDR 0002/0003/0007/0011.
- **Cross-tenant isolation gate** — `packages/db/src/isolation.test.ts` (canonical, runs as `aiims_app`
  vs real Postgres — TDR-0006) + an offline **semantic model** that runs here without a DB.
- **`apps/api`** (NestJS/Fastify) — dev-OIDC auth guard, **tenant-context interceptor** (tx + SET LOCAL),
  RBAC authz guard, **audit + transactional outbox** (atomic with the write), in-process event bus,
  feature flags, **adapter ports + mocks** (ABDM/consent/payment/notification/AI), Problem-Details error
  filter (no PHI), health, and one **audited tenant-scoped write** (`/v1/notes`).
- **`packages/*`** — domain-types, config (Zod fail-fast), event-schemas, api-contracts, authz, testing.
- **CI** (`.github/workflows/ci.yml`) with the **isolation gate as a blocking job**; Dockerfile (non-root);
  Terraform dev skeleton (`ap-south-1`).

## Run (in a provisioned environment — needs npm registry + Postgres)
```
pnpm install
pnpm build
DATABASE_URL_OWNER=postgres://postgres@localhost:5432/aiims pnpm --filter @aiims/db migrate
DATABASE_URL_APP=postgres://aiims_app@localhost:5432/aiims pnpm --filter @aiims/db test:isolation   # TDR-0006 GATE
pnpm --filter @aiims/api start
# demo the audited tenant-scoped write:
curl -XPOST localhost:3000/v1/notes -H 'content-type: application/json' \
  -H 'x-dev-tenant: 018f0000-0000-7000-8000-00000000000a' -H 'x-dev-roles: doctor' -d '{"body":"hello"}'
```

## Verification status in THIS sandbox
The build sandbox **blocks the npm registry (403) and has no Postgres/Docker/AWS**, so runtime gates
(`pnpm build`, isolation test vs real Postgres, deploy) were **not executed here**. Offline checks that
DID run: all configs parse, scripts pass `node --check`, and the RLS **semantic model passes 5/5**
(including the guardrail that policy-removal breaks isolation). See `STAGE-0-REPORT.md` for the full
DoD/acceptance matrix and the exact commands to close each runtime gate in a provisioned environment.

Frozen architecture docs live one level up (this repo is `apps/`, `packages/`, `infra/`).
