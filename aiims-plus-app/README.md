# AIIMS+ — Application Monorepo

**Stages 0–2 (Walking Skeleton, Core Platform, Patient Module)** of the AIIMS+ Hospital Operating System, implemented strictly
against the frozen architecture in the repository root (`../architecture/`, `../DECISION-REGISTRY.md`,
`../IMPLEMENTATION-MASTER-PLAN.md` §10–§12). **No Stage 3 code.**

> **Constitution (non-negotiable):** no clinical AI, no diagnosis, no medicine recommendations;
> doctors make all clinical decisions; security, privacy, and audit are mandatory.

## What exists after Stage 0

| Area               | Delivered                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo           | pnpm workspaces + Turborepo; strict TS; **BDR-0013 boundary ESLint** (dependency-inward layers, Drizzle confined to `packages/db`); Prettier; Husky + lint-staged + commitlint                                                                           |
| Tenancy substrate  | `tenant_id` + **FORCE RLS** fail-closed policies as **hand-written reviewed SQL** (DDR-0002/0011), least-privilege roles (`aiims_app` has no BYPASSRLS, DDR-0003), tenant-scoped composite FKs (DDR-0008), transaction-scoped `SET LOCAL` context helper |
| **Isolation gate** | `packages/testing` — TDR-0006 suite vs real Postgres as `aiims_app`, **merge-blocking in CI**, incl. the guardrail that an RLS drop is detected                                                                                                          |
| Identity           | Keycloak OIDC (dev realm auto-imported by compose); JWKS verification; principal + RBAC roles resolved under the token's own tenant context                                                                                                              |
| AuthZ              | `packages/authz` PDP (RBAC now, ABAC-ready — SDR-0002); guard PEP, deny-by-default                                                                                                                                                                       |
| Event backbone     | Transactional **outbox** + per-tenant dispatcher → in-process bus + BullMQ (DDR-0007/BDR-0005)                                                                                                                                                           |
| Audit              | **Hash-chained, append-only** `audit.audit_log`, written atomically in the business transaction; `UPDATE/DELETE` revoked (ADR-0005)                                                                                                                      |
| Flags & adapters   | DB-backed feature flags; five integration ports (ABDM/consent/payment/notification/AI) with mock defaults (BDR-0008/ADR-0010)                                                                                                                            |
| API conventions    | Contract-first Zod + generated OpenAPI 3.1; RFC 9457 Problem Details; correlation ids (APDR-0003/0014)                                                                                                                                                   |
| Core Platform (S1) | `/v1/tenants` (platform operators, idempotent), `/v1/organizations                                                                                                                                                                                       | facilities | departments`, `/v1/users`+ role assignment,`/v1/reference/*` — every write = row + outbox + audit, atomic; duplicate-safe natural keys |
| Scaffolds          | `apps/web` (Next.js), `apps/mobile` (lazy, per Master Plan §4), `apps/ai` (FastAPI stub)                                                                                                                                                                 |
| CI                 | `.github/workflows/ci.yml` — TDR-0012 gate order; isolation gate + RLS policy-diff blocking; scans; Docker build; deploy job gated on AWS                                                                                                                |
| Infra              | `infra/` Terraform skeleton (`ap-south-1`); **apply deferred** until the AWS dev account exists                                                                                                                                                          |

## Run it locally

```bash
# 0. Prereqs: Node 22 (see .nvmrc), pnpm via corepack, Docker (colima works: `colima start`)
corepack enable pnpm
pnpm install

# 1. Local substrate: Postgres 16 + Redis + Keycloak (realm auto-import) + MinIO
docker compose up -d

# 2. Environment
cp .env.example .env && set -a && source .env && set +a

# 3. Migrate (reviewed SQL, runs as migrator) + seed synthetic tenants A/B
pnpm db:migrate && pnpm db:seed

# 4. Build & start the API
pnpm build && pnpm --filter @aiims/api start
```

Demo the Stage 0 exit criteria:

```bash
# Login via Keycloak (synthetic user doctor.a, tenant A)
TOKEN=$(curl -s -X POST http://localhost:8080/realms/aiims/protocol/openid-connect/token \
  -d grant_type=password -d client_id=aiims-cli -d username=doctor.a -d password=doctor \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Tenant-scoped, audited read of the directory (writes need the admin role)
curl -s localhost:3000/v1/organizations -H "Authorization: Bearer $TOKEN"
curl -s "localhost:3000/v1/reference/codes?system=icd-10&limit=5" -H "Authorization: Bearer $TOKEN"

# Cross-tenant proof: doctor.b (tenant B) sees nothing
# RBAC proof: frontdesk.a gets 403 on POST
```

Stage 1 demo (platform operator → tenant bootstrap → directory):

```bash
PA=$(curl -s -X POST http://localhost:8080/realms/aiims/protocol/openid-connect/token \
  -d grant_type=password -d client_id=aiims-cli -d username=platform.admin -d password=platform \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST localhost:3000/v1/tenants -H "Authorization: Bearer $PA" \
  -H 'content-type: application/json' -d '{"slug":"my-clinic","name":"My Clinic"}'
# then log in as the tenant admin and build org → facility → departments → users
```

## Gates

```bash
pnpm lint            # incl. BDR-0013 boundary rules — violations fail
pnpm test            # unit tests
pnpm test:isolation  # THE cross-tenant isolation gate (TDR-0006) — needs Docker
pnpm --filter @aiims/db check:rls   # DDR-0011 policy-diff gate
```

> Testcontainers with colima: `export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock`
> (or keep `~/.testcontainers.properties` pointing at it).

## Layout & rules

```
apps/       api (NestJS monolith) · web (Next.js) · mobile (lazy) · ai (FastAPI stub)
packages/   domain-types · api-contracts · event-schemas · config · authz · db · testing
            design-tokens · ui-web · ui-native
tooling/    typescript-config · eslint-config (the boundary rules)
infra/      Terraform (ap-south-1) — apply gated on AWS account
docker/     Keycloak dev realm
```

- Dependencies flow **inward** (`api → application → domain ← ports ← infrastructure`); enforced by lint.
- **Drizzle and pg exist only in `packages/db`** (ADR-0011 fallback preserved); apps use its typed helpers.
- Every data access runs inside a tenant-context transaction; unset context **fails closed**.
- No PHI in logs, events, errors, or any non-prod data — synthetic fixtures only (TDR-0013).
- Conventional Commits enforced; trunk-based; small PRs (Master Plan §26).

Status & verification evidence: [STAGE-0-STATUS.md](./STAGE-0-STATUS.md) · [STAGE-1-STATUS.md](./STAGE-1-STATUS.md) · [STAGE-2-STATUS.md](./STAGE-2-STATUS.md).
