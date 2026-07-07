# AIIMS+ — Stage 3 Health-Report Fixes (M-1, L-1, L-2)

**Date:** 2026-07-07 · **Owner:** Founders / Eng · **Source:** `PROJECT-HEALTH-REPORT.md` findings
**Scope:** the three findings from the cumulative Stage 0–3 health report, fixed before Stage 4.
**Frozen architecture:** untouched — no migration, schema, RLS policy, domain rule, or xDR decision changed.

## Summary

| ID  | Severity | Title                                                                     | Status   |
| --- | -------- | ------------------------------------------------------------------------- | -------- |
| M-1 | Medium   | OpenAPI document stale (Stage 2 + Stage 3 endpoints missing)              | ✅ FIXED |
| L-1 | Low      | Root `test:isolation` script targeted the wrong package                   | ✅ FIXED |
| L-2 | Low      | Turbo dropped Testcontainers env → integration silently skipped on Colima | ✅ FIXED |

**Final status: PASS.** All gates green; local execution now matches CI.

---

## M-1 · OpenAPI document did not cover Stage 2/3 endpoints

**Issue.** `packages/api-contracts/src/generate-openapi.ts` documented only the Stage 0/1 surface.
`/v1/patients`, `/v1/practitioners`, and both FHIR read endpoints were entirely absent, so the derived
OpenAPI artifact under-represented the API by two stages.

**Root cause.** The document is contract-first (APDR-0014) and hand-assembled from the Zod schemas, but the
assembly was never extended when the patient (Stage 2) and practitioner (Stage 3) modules landed. Nothing
forced the document to keep pace with the controllers, so it drifted silently. The Zod DTOs — the enforced
runtime source of truth — were always complete; only the published document lagged.

**Fix.**

1. Extended `generate-openapi.ts` with every missing path, derived from the same Zod schemas the controllers
   use (no hand-written shapes):
   - `POST /v1/patients` (Idempotency-Key required; 201 create / 200 replay / 409), `GET /v1/patients` (search),
     `GET`+`PATCH /v1/patients/{id}` (If-Match → 409), `GET /fhir/R4/Patient/{id}` (dark).
   - `POST /v1/practitioners` (201 + warnings / 409 / 404), `GET /v1/practitioners` (search),
     `GET`+`PATCH /v1/practitioners/{id}`, `GET /fhir/R4/Practitioner/{id}` (dark).
   - Corrected the `reference/codes` `system` enum to include `specialty` (added in Stage 3).
   - Bumped `info.version` 0.1.0 → 0.3.0 and refreshed the description.
   - Added reusable `readById` / `patchById` / `fhirRead` builders so future resources stay consistent.
     Paths grew 10 → **16**.
2. **Automated, CI-blocking coverage gate** — `apps/api/src/openapi-coverage.test.ts`. It reflects over the
   **real Nest module graph** (pure metadata; no app boot, no DB) to enumerate every mounted controller
   route, then asserts each `{method, path}` exists in `openApiDocument.paths`. A guard asserts the walk
   found ≥15 routes (so an empty walk can't false-pass). Because it runs in `pnpm test` (the CI `static`
   job), **any new endpoint that isn't documented fails CI** — the artifact can no longer drift behind the
   code. This directly closes the "future endpoints cannot be added without appearing in OpenAPI" requirement.
3. Added `openapi.json` to `.gitignore` — the emitted JSON is generated on demand; the `openApiDocument`
   object remains the single source of truth (consistent with the F3 "no generated artifacts committed" guard).

**Verification.**

- `pnpm --filter @aiims/api-contracts openapi` emits 16 paths incl. patients, practitioners, and both FHIR reads.
- New coverage gate passes and is proven non-vacuous (discovers ≥15 real routes incl. the patient/practitioner POSTs).
- `apps/api` unit suite: 6 → **8** tests (2 files → 3).

---

## L-1 · Root `test:isolation` script targeted the wrong package

**Issue.** `pnpm test:isolation` from the repo root failed with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.

**Root cause.** The root script read `pnpm --filter @aiims/db test:isolation`, but the isolation gate lives
in `@aiims/testing`; `@aiims/db` has no such script. CI was unaffected (it already calls
`pnpm --filter @aiims/testing test:isolation`), so this was a local-only divergence from CI.

**Fix.** Repointed the root script to `pnpm --filter @aiims/testing test:isolation` — byte-for-byte the CI
command, so local execution now matches CI.

**Verification.** `pnpm test:isolation` from root → **16/16 passed** on Colima.

---

## L-2 · Turbo dropped Testcontainers env → integration silently skipped on Colima

**Issue.** `pnpm test:integration` (root, via `turbo run`) reported the suites as _skipped_ (17 skipped, 0
run) on Colima — a deceptive "green-looking" result — while the direct package script passed 17/17.

**Root cause.** Turbo runs tasks in a sanitized environment and does not forward undeclared variables. The
Testcontainers socket override (`TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`) and `DOCKER_HOST` never reached the
runner, so container setup failed and the specs were skipped. CI was unaffected because it reuses a Postgres
service via `ISOLATION_DATABASE_URL` rather than spawning containers.

**Fix.** Added `passThroughEnv` to the `test:integration` **and** `test:isolation` tasks in `turbo.json` for:
`DOCKER_HOST`, `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`, `TESTCONTAINERS_RYUK_DISABLED`,
`TESTCONTAINERS_HOST_OVERRIDE`, `ISOLATION_DATABASE_URL`, `DATABASE_URL_MIGRATOR`.

**Verification.** `pnpm test:integration` from root (Turbo path) → **17/17 passed** on Colima (previously 17
skipped). No behavioural change in CI (those vars are simply forwarded when present).

---

## Full verification sweep (this session)

| Gate                                 | Command                                         | Result                                                                                     |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| format                               | `pnpm format`                                   | clean ✅                                                                                   |
| build                                | `pnpm build`                                    | 13/13 ✅                                                                                   |
| typecheck                            | `pnpm typecheck`                                | 22/22 ✅                                                                                   |
| lint (BDR-0013)                      | `pnpm lint`                                     | clean ✅                                                                                   |
| unit (incl. contract + **M-1 gate**) | `pnpm test`                                     | **52 passed** (api-contracts 14, api 8, authz 10, crypto 11, events 4, config 3, web 2) ✅ |
| crypto coverage                      | `pnpm --filter @aiims/crypto test`              | 98.5% ≥ 90% ✅                                                                             |
| integration (root, Turbo)            | `pnpm test:integration`                         | **17/17** on Colima ✅                                                                     |
| integration (CI-verbatim)            | `pnpm --filter @aiims/testing test:integration` | 17/17 ✅                                                                                   |
| isolation (root)                     | `pnpm test:isolation`                           | **16/16** ✅                                                                               |
| isolation (CI-verbatim)              | `pnpm --filter @aiims/testing test:isolation`   | 16/16 ✅                                                                                   |
| RLS policy gate                      | `pnpm --filter @aiims/db check:rls`             | all present/enabled/FORCED ✅                                                              |
| OpenAPI regeneration                 | `pnpm --filter @aiims/api-contracts openapi`    | 16 paths emitted ✅                                                                        |

**CI pipeline:** the `static` job (`format:check`, `lint`, `build`, `typecheck`, `test`, crypto coverage)
now also runs the M-1 coverage gate as a blocking check; `isolation-gate`, `integration-gate`,
`security-scans`, `terraform-validate`, `docker-build` unchanged and green. Gate order per TDR-0012 preserved.

**Local ≡ CI:** the two root convenience scripts now behave identically to their CI counterparts on Colima.

## Frozen-architecture safety

Files changed: `packages/api-contracts/src/generate-openapi.ts`, `apps/api/src/openapi-coverage.test.ts`
(new), root `package.json`, `turbo.json`, `.gitignore`. **No** migration, DB schema, RLS policy, domain
rule, event schema, or xDR decision was modified. `git status` confirms nothing under `migrations/`,
`schema/`, `domain/`, or `DECISION-REGISTRY.md` was touched.

---

**Final status: PASS. Stage 4 not started — awaiting approval.**
