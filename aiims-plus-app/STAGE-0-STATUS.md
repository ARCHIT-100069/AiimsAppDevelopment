# AIIMS+ — Stage 0 (Walking Skeleton) — Status & Verification Report

**Date:** 2026-07-05 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §10
**Purpose:** map every Stage 0 deliverable, exit criterion, and DoD item to its verification
evidence — honestly. Built fresh (the prior unverified build is preserved untouched in
`../aiims-plus/` as read-only reference; no code was copied).

## Deliverables (Master Plan §10)

| Deliverable                                                              | Status                              | Evidence                                                                                                           |
| ------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Monorepo + tooling + package bootstrap (§6 order)                        | ✅ Verified                         | `pnpm build` 12/12 green; bootstrap order in `packages/*`                                                          |
| Dependency-inward boundaries (BDR-0013)                                  | ✅ Verified                         | `tooling/eslint-config` layer matrix; **the lint itself forced two files into the right layer during development** |
| Tenancy substrate: `tenant_id` + FORCE RLS + SET LOCAL (DDR-0002/0003)   | ✅ Verified                         | `packages/db/src/migrations/0001_security.sql`; isolation gate green                                               |
| Least-privilege roles (`aiims_app` no BYPASSRLS)                         | ✅ Verified                         | gate runs as `aiims_app`; audit UPDATE/DELETE denied test                                                          |
| Audit outbox + hash-chained audit (DDR-0007)                             | ✅ Verified                         | E2E: outbox `dispatched=true`, audit chain intact across 2 rows (window-function check)                            |
| In-process event bus + BullMQ fan-out (BDR-0005)                         | ✅ Verified                         | BullMQ job present in Redis keyed by event id                                                                      |
| Feature-flag framework (ADR-0010)                                        | ✅ Verified                         | `platform.feature_flag` seeded; per-tenant override query                                                          |
| Adapter/mock convention: ABDM/consent/payment/notification/AI (BDR-0008) | ✅ Verified                         | DI test resolves all 5 ports; `real` mode fails fast                                                               |
| Keycloak OIDC + RBAC skeleton (SDR-0001/0002)                            | ✅ Verified                         | real Keycloak login E2E; PDP unit tests; 403 denial logged as security signal                                      |
| API conventions + Problem Details (APDR-0003/0014)                       | ✅ Verified                         | 401/403/422 envelopes observed E2E; OpenAPI 3.1 generated from contracts                                           |
| Audited tenant-scoped write (skeleton proof)                             | ✅ Verified                         | `POST /v1/notes` → note + outbox + audit in ONE transaction                                                        |
| CI with isolation gate + scans (TDR-0006/0012, SDR-0012)                 | ✅ Implemented                      | `.github/workflows/ci.yml` (gate order; blocking) — runs on first push to GitHub                                   |
| Dockerfile (multi-stage, non-root) (IDR-0005)                            | ✅ Implemented                      | `apps/api/Dockerfile`; built by the CI docker-build job                                                            |
| Terraform dev skeleton, ap-south-1 (IDR-0012)                            | ✅ Validated                        | `terraform validate` passes locally + in CI; **apply deferred**                                                    |
| Deploy to `ap-south-1` dev                                               | ⏳ **Deferred by founder decision** | AWS dev account not yet bootstrapped; CI deploy job auto-activates when `AWS_DEPLOY_ROLE_ARN` is set               |

## Exit criteria (Master Plan §10)

| Exit criterion                                          | Status | Evidence (local, docker-compose substrate)                                                                                                                                                                                |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User logs in (Keycloak) and is scoped to a tenant       | ✅     | Password grant vs the imported `aiims` realm; `tenant_id` claim drives `SET LOCAL app.tenant_id`; token expiry enforced (observed 401 after 300 s)                                                                        |
| A trivial tenant-scoped write is audited via the outbox | ✅     | `POST /v1/notes` 201 → outbox event (dispatched, attempts=1) + audit row with `id = event id`                                                                                                                             |
| **Cross-tenant isolation gate green**                   | ✅     | **11/11** vs real Postgres as `aiims_app` — incl. WITH CHECK rejection, fail-closed unset context, and the guardrail that disabling RLS IS detected; also proven through the API (doctor.b sees zero of tenant A's notes) |
| App deployed to dev                                     | ⏳     | Deferred with the AWS account (above) — the only open item                                                                                                                                                                |
| All mock adapters resolve                               | ✅     | DI resolution test, all five ports answer                                                                                                                                                                                 |

## Definition of Done (§20) — Stage-0 scope

| DoD item                                   | Status                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Implements frozen design; nothing reopened | ✅ — one new record authored via governance: **IDR-0016** (local dev env; registry updated)      |
| Unit + integration + contract tests green  | ✅ 20 unit tests; isolation suite = the Stage-0 integration suite; contract shapes tested        |
| **Isolation suite green**                  | ✅ 11/11 (Testcontainers + compose Postgres, both)                                               |
| CI security scans                          | ✅ wired (gitleaks, pnpm audit, trivy config, terraform validate) — execute on first GitHub push |
| No PHI in logs/telemetry; audit emitted    | ✅ by construction: pino redaction, no-console lint, references-only events; synthetic data only |
| Deployed to staging; smoke tests           | ⏳ follows the AWS bootstrap (staging env is a Stage-gate concern, §23)                          |
| Exit criteria demoed                       | ✅ demo script in `README.md` (run end-to-end during this build)                                 |
| Docs updated                               | ✅ READMEs, IDR-0016 + registry, this report                                                     |
| No open critical/security issues           | ✅ none known                                                                                    |

## Deviations & engineering notes (transparency log)

1. **Drizzle version (ADR-0011 guardrail #4):** v1.0 is at **rc.4** — not GA. Pinned the
   production-proven **0.45.2 stable** line (meets every ADR-0011 need: in-schema RLS, JSONB/GIN,
   SQL-first). Upgrade to 1.0 post-GA; ORM confined to `packages/db` keeps it contained.
   _No Prisma fallback trigger._
2. **RLS policy pattern:** `NULLIF(current_setting('app.tenant_id', true), '')::uuid` — the plain
   `::uuid` cast errors on the empty-string GUC left after transaction-local settings revert on
   pooled connections. NULLIF preserves DDR-0002's exact fail-closed semantics (NULL → zero rows).
3. **Audit write placement:** audit rows are appended **inside the business transaction**
   (Master Plan §3.4 "one transaction = one tenant + write + outbox + audit"; BDR-0004), with
   `audit.id = outbox.id` keeping the 1:1 outbox correspondence of ADR-0005/DDR-0007. The hash
   chain is **per tenant** (the only chain readable under RLS), serialized by an advisory xact lock.
4. **Outbox dispatch matches on event id only** — Postgres microsecond timestamps never equal a JS
   millisecond Date; the composite predicate silently updated 0 rows (caught in E2E, fixed).
5. **Mobile scaffold is dependency-light** per Master Plan §4 ("scaffolded lazily"); Expo deps land
   with the frontend stage. `apps/ai` is a FastAPI stub outside the pnpm workspace (AIDR-0003).
6. **Toolchain reality vs plan:** ESLint 10 / Zod 4 / NestJS 11 / Next 16 / pnpm 11 / Node 22
   pinned; vitest 4 cannot parse legacy-decorator syntax in test files (worked around with
   programmatic decorator application in one test).

## To close the last gate (when the AWS dev account exists)

```bash
# 1. Bootstrap account + state backend, uncomment backend block (infra/README.md)
# 2. Set AWS_DEPLOY_ROLE_ARN repo variable (OIDC role)  → CI deploy job activates
terraform -chdir=infra/envs/dev init && terraform -chdir=infra/envs/dev apply
```

**Conclusion:** Stage 0 is implemented, tested, and verified locally in full — every exit
criterion except the AWS deploy (explicitly deferred by founder decision) is demonstrated green.
**Stage 1 has not been started.**
