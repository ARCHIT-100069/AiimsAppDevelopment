# AIIMS+ — Stages 0–1 Full Verification Report

**Date:** 2026-07-05 · **Trigger:** founder-ordered pre-Stage-2 verification ("do not assume anything is correct")
**Method:** every claim exercised by actually running the project on the local substrate
(docker-compose: Postgres 16 / Redis 7 / Keycloak 26 / MinIO). One failure was found, fixed, and
the **entire chain was rerun** before this report was written.

## Results — all 18 checks PASS (after one fix, see Bugs)

| #   | Check                       | Verdict                  | Command                                                                                                               | Output summary                                                                                                                                                                |
| --- | --------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–2 | Dependencies installed      | ✅ PASS                  | `pnpm install --frozen-lockfile`                                                                                      | lockfile satisfied; native builds vetted via `allowBuilds`                                                                                                                    |
| 3   | Build                       | ✅ PASS                  | `pnpm build`                                                                                                          | 12/12 turbo tasks (10 packages + api + web)                                                                                                                                   |
| 4   | Typecheck                   | ✅ PASS                  | `pnpm typecheck`                                                                                                      | 19/19 tasks, TS strict                                                                                                                                                        |
| 5   | Lint + format               | ✅ PASS                  | `pnpm lint` · `pnpm format:check`                                                                                     | 0 problems (incl. BDR-0013 boundary rules); Prettier clean                                                                                                                    |
| 6   | Unit test suite             | ✅ PASS                  | `pnpm test`                                                                                                           | 25 tests / 5 suites (authz matrix, contracts, events, config, adapters-resolve)                                                                                               |
| 7   | Integration tests           | ✅ PASS                  | `pnpm --filter @aiims/testing test:integration`                                                                       | 5/5 vs real Postgres (FK graft rejection DDR-0008, duplicate-safety, idempotent replays)                                                                                      |
| 8   | **Tenant isolation gate**   | ✅ PASS                  | `pnpm --filter @aiims/testing test:isolation`                                                                         | **12/12** as `aiims_app` under FORCE RLS, incl. RLS-drop guardrail detection                                                                                                  |
| 9   | Compose services healthy    | ✅ PASS                  | `docker compose ps`                                                                                                   | postgres/redis/minio/keycloak all `(healthy)`                                                                                                                                 |
| 10  | Service probes              | ✅ PASS                  | `pg_isready` · `redis-cli ping` · MinIO `/minio/health/live` · Keycloak `/realms/aiims`                               | accepting connections · PONG · live · realm `aiims`                                                                                                                           |
| 11  | Migrations fully applied    | ✅ PASS                  | `SELECT name FROM platform.schema_migrations`                                                                         | 5/5 applied = 5 files on disk (0000–0004)                                                                                                                                     |
| 12  | Drizzle ↔ DB parity         | ✅ PASS                  | column-probe script (`SELECT` of every mapped column per table)                                                       | **13/13 tables, 0 drifted**                                                                                                                                                   |
| 13  | OpenAPI generation          | ✅ PASS                  | `pnpm --filter @aiims/api-contracts openapi`                                                                          | valid 3.1 doc, 10 paths (full Stage-1 surface)                                                                                                                                |
| 14  | NestJS API starts           | ✅ PASS                  | `node apps/api/dist/main.js`                                                                                          | `/healthz` ok, `/readyz` ok (DB-checked), unauth `/v1/*` → 401                                                                                                                |
| 15  | Next.js web starts          | ✅ PASS                  | `PORT=3001 pnpm --filter @aiims/web dev`                                                                              | page renders `<h1>AIIMS+</h1>`; `/api/healthz` ok                                                                                                                             |
| 16  | Expo mobile                 | ✅ PASS (scaffold-scope) | JSON validity + workspace membership                                                                                  | `app.json`/`package.json` valid; **no build by approved design** — Master Plan §4 scaffolds mobile lazily at the frontend stage; there is deliberately no Expo dependency yet |
| 17  | No TODO/FIXME/failing gates | ✅ PASS                  | marker sweep (`grep -rniE` for TODO/FIXME/XXX/HACK) over apps/packages/tooling/infra/docker/.github + skip/only sweep | zero markers; zero skipped/focused tests; working tree clean                                                                                                                  |
| 18  | Exit criteria (Stage 0 + 1) | ✅ PASS                  | live E2E (below)                                                                                                      | all criteria re-demonstrated except the founder-deferred AWS deploy                                                                                                           |

### CI-parity gates also run locally

| Gate             | Verdict             | Command                                              | Summary                                                               |
| ---------------- | ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Dependency audit | ✅ PASS (after fix) | `pnpm audit --prod --audit-level=high`               | **initially FAILED** — see Bugs; now "No known vulnerabilities found" |
| Terraform        | ✅ PASS             | `terraform fmt -check -recursive infra` · `validate` | fmt clean; configuration valid                                        |
| RLS policy-diff  | ✅ PASS             | `pnpm --filter @aiims/db check:rls`                  | all policies present, enabled, FORCED                                 |

### Check 18 detail — exit criteria re-demonstrated live

**Stage 0 (§10):** doctor.a Keycloak login → tenant-scoped 200 on `/v1/organizations`; a fresh
audited write (org create → 201) grew the audit log 10→11 with **outbox 100% dispatched**; isolation
gate green (C8); all five mock adapters resolve (C6 + clean boot log); **deploy to ap-south-1
remains the single deferred item (founder decision, AWS account pending)** — CI deploy job is wired
and keyed to `AWS_DEPLOY_ROLE_ARN`.

**Stage 1 (§11):** tenant-create replay → idempotent 200; frontdesk.a `org:manage` → 403;
platform.admin on tenant data → 403 (registry-only); doctor.b sees **0** of other tenants'
organizations through the API; ICD-10 reference codes queryable; **per-tenant audit hash chains: 2
tenants, ALL INTACT**.

## Bugs found & fixed during this verification

1. **Dependency audit gate FAILED — 1 critical, 5 high, 4 moderate, 1 low.**
   - `handlebars ≤4.7.8` (critical JS-injection + DoS) pulled in by `eslint-plugin-boundaries`;
     the lint toolchain was wrongly modeled as _production_ dependencies of `@aiims/eslint-config`.
   - `multer <2.2.0` (high DoS) via `@nestjs/platform-express` — a real runtime dependency.
   - `postcss <8.5.10` (moderate XSS) via `next`.
   - **Fix:** lint-time packages moved to `devDependencies` (correct modeling — they never ship);
     pnpm `overrides` force `handlebars ≥4.7.9`, `multer ≥2.2.0`, `postcss ≥8.5.10` (documented in
     `pnpm-workspace.yaml` per SDR-0012). Full chain rerun after the fix: build 12/12, lint clean,
     unit 25/25, integration 5/5, isolation 12/12, audit clean, API boot smoke ok.

2. **Hygiene:** `next dev` rewrites the generated `apps/web/next-env.d.ts`, dirtying the tree on
   every web run. Untracked + gitignored (generated file).

## Warnings (no action required now)

- **gitleaks / Semgrep-class SAST / Trivy config scans** are CI-wired but have not executed because
  the repo has no GitHub remote yet — they run on first push. Local proxies run here: secret-free
  tree by construction (`.env` ignored; grep for committed credentials found only documented
  local-dev defaults), `pnpm audit` clean, terraform validate clean.
- `pnpm audit` covers **published advisories only**; the override pins should be revisited when
  upstreams (`@nestjs/platform-express`, `next`) ship patched transitives natively.
- Coverage thresholds (TDR-0012 ≥90% domain / ≥80% overall) are not yet enforced as a numeric CI
  gate; test breadth currently tracks the stage scope. Recommend wiring `vitest --coverage`
  thresholds when Stage 2 introduces the first substantial domain layer.

## Recommended next actions (not started)

1. Push to GitHub → first CI run executes the full gate order incl. scans; enable branch protection.
2. Wire coverage thresholds into `vitest` configs + CI (TDR-0012) at Stage 2 kickoff.
3. When the AWS dev account lands: bootstrap state backend → set `AWS_DEPLOY_ROLE_ARN` → the
   deploy-dev job closes the last open exit criterion of Stages 0–1.

**Verdict: Stages 0 and 1 are verified working end-to-end. Stage 2 has NOT been started.**
