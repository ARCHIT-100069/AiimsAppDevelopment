# AIIMS+ — Cumulative Project Health Report (Stages 0–3)

**Date:** 2026-07-06 · **Owner:** Founders / Eng · **Scope:** read-only cumulative verification of Stages 0, 1, 2, 3
**Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` · **Registry:** `../DECISION-REGISTRY.md`
**Method:** full gate sweep + live DB inspection (compose Postgres) + structural/static audit. **No files modified** (this report excepted).

## Verdict

**PASS — Stage 4 may proceed after addressing 1 Medium finding (OpenAPI drift).**
All frozen guarantees hold across every stage. No functional regression. No boundary, RLS, audit, or
outbox integrity violations. Three findings total: **1 Medium** (documentation/contract-artifact drift,
pre-existing since Stage 2) and **2 Low** (local developer-experience script issues; CI unaffected).

---

## 1. Stage-by-stage guarantee check

| Stage | Guarantee                                                                    | Status  | Evidence                                                                                               |
| ----- | ---------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| **0** | Monorepo, strict TS, boundary lint, conventional commits, CI skeleton        | ✅ PASS | typecheck 22/22, `pnpm lint` (BDR-0013) clean, `format:check` clean, build 13/13                       |
| **0** | No Drizzle/pg outside `@aiims/db` (BDR-0003)                                 | ✅ PASS | grep: zero `drizzle-orm` imports outside `packages/db`                                                 |
| **1** | Core Platform (tenant/org/facility/dept/user/role), RLS FORCE, outbox, audit | ✅ PASS | migrations 0000–0004; isolation gate green; platform integration ×5                                    |
| **1** | Tenant-scoped composite FKs (DDR-0008), duplicate-safe 409                   | ✅ PASS | integration: cross-tenant facility attach rejected; dup dept code rejected                             |
| **2** | Field-encrypted patient identifiers + blind index (DDR-0006)                 | ✅ PASS | crypto suite 11/11, **coverage 98.5% ≥ 90%**; integration: ciphertext-at-rest + blind-index lookup     |
| **2** | Patient APIs, search, optimistic concurrency, idempotency, dark FHIR         | ✅ PASS | patient integration ×6; FHIR Patient 404 while `fhir.read` false                                       |
| **3** | Practitioner over app_user, immutable link, RBAC, role warning, dark FHIR    | ✅ PASS | practitioner integration ×5; isolation probes ×2; live E2E 12/12 (per STAGE-3-STATUS.md, re-confirmed) |
| **3** | `clinical.practitioner` FORCE RLS + tenant-scoped composite FK               | ✅ PASS | migration 0007/0008; RLS gate lists `clinical.practitioner`; FK graft rejected                         |

**Test totals (re-run this session):** unit **50/50**, integration **17/17**, isolation **16/16**, crypto coverage **98.5%**. All green.

---

## 2. Cross-cutting verification

| Dimension                                     | Result               | Evidence                                                                                                                                                                                              |
| --------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No regression**                             | ✅ PASS              | full sweep green; all prior stages' tests still pass unchanged                                                                                                                                        |
| **Contracts synchronized (runtime)**          | ✅ PASS              | DTOs single-sourced in `@aiims/api-contracts`; controllers map domain→DTO; only inline schema is `codesQuerySchema` which _extends_ the shared `listQuerySchema` (a query guard, not a duplicate DTO) |
| **Contracts synchronized (OpenAPI artifact)** | ⚠️ **FINDING M-1**   | `generate-openapi.ts` documents only Stage 0/1 paths; `/v1/patients` and `/v1/practitioners` absent                                                                                                   |
| **No orphan migrations**                      | ✅ PASS              | files 0000–0008 sequential, no gaps; `platform.schema_migrations` matches file set exactly                                                                                                            |
| **No dead code**                              | ✅ PASS              | 0 `TODO/FIXME/HACK/XXX/@ts-ignore` in source (40 hits all in generated `apps/web/.next/`, git-ignored); `note` remains only in immutable historical migrations 0000/0001/0004                         |
| **No duplicated DTOs**                        | ✅ PASS              | schemas defined once in contracts; `relay()` BFF helper single-sourced (F6 fix intact)                                                                                                                |
| **No boundary violations**                    | ✅ PASS              | `pnpm lint` enforces BDR-0013 dependency-inward + Drizzle confinement — clean                                                                                                                         |
| **No RLS policy regressions**                 | ✅ PASS              | `check:rls`: all policies present, enabled, FORCED (incl. `clinical.practitioner`)                                                                                                                    |
| **Audit chain integrity**                     | ✅ PASS              | hash-chain link check: **0 breaks across 31 rows / all tenants**                                                                                                                                      |
| **Outbox integrity**                          | ✅ PASS              | 19 events, **19 dispatched, 0 pending, max 1 attempt**; all distinct event types registered in `EVENT_PAYLOAD_SCHEMAS`                                                                                |
| **CI pipeline**                               | ✅ PASS              | 7 blocking jobs; isolation + integration gates invoke correct package scripts; gate order per TDR-0012                                                                                                |
| **Docker Compose**                            | ✅ PASS              | `docker compose config` valid; postgres/redis/keycloak/minio healthy                                                                                                                                  |
| **Terraform**                                 | ✅ PASS              | `fmt -check -recursive` clean; `validate` on `infra/envs/dev` → "configuration is valid"; 5 modules present                                                                                           |
| **Documentation / READMEs**                   | ✅ PASS (see N-1)    | STAGE-0..3 reports present; root + infra + per-app READMEs present                                                                                                                                    |
| **Decision Registry**                         | ✅ PASS              | `DECISION-REGISTRY.md` = frozen 10-phase architecture index; stage decisions recorded in STAGE-*-STATUS.md per working convention                                                                     |
| **Status reports**                            | ✅ PASS              | STAGE-0-STATUS, STAGE-1-STATUS, STAGE-2-STATUS/FIXES/VERIFICATION, STAGE-3-STATUS all present                                                                                                         |
| **Open issues**                               | ✅ tracked (see N-1) | `Open-Issues-and-Assumptions.md` present; open founder items D-1, D-2 predate implementation                                                                                                          |

---

## 3. Findings

### M-1 · Medium · OpenAPI document is stale (Stage 2 + Stage 3 missing)

`packages/api-contracts/src/generate-openapi.ts` emits paths for **only** the Stage 0/1 surface
(`/healthz`, `/readyz`, `/v1/tenants|organizations|facilities|departments|users`, `/v1/reference/*`).
It is **missing `/v1/patients` (Stage 2) and `/v1/practitioners` (Stage 3)** entirely, and their FHIR
read endpoints.

- **Not a runtime defect.** The Zod DTOs are the enforced source of truth (APDR-0014, DTO-only), and they
  are complete and validated by contract tests. The runtime API is correct.
- **Impact:** the _published_ OpenAPI artifact under-represents the API by two stages. Any external client
  generation, API docs, or contract consumer would be misled. Drift compounds each stage.
- **Origin:** pre-existing since Stage 2 (patients were never added); Stage 3 inherited and extended it.
  Neither STAGE-2-STATUS nor STAGE-3-STATUS claimed OpenAPI coverage for these paths, so this is an
  **omission, not a false claim**.
- **Recommendation:** extend `generate-openapi.ts` to include patient + practitioner paths (and assert
  their presence in `contracts.test.ts`) **before Stage 4**, or record an explicit deferral decision so
  the gap is intentional and tracked.

### L-1 · Low · Root `test:isolation` script targets the wrong package (local DX only)

Root `package.json` → `"test:isolation": "pnpm --filter @aiims/db test:isolation"`, but `@aiims/db` has
no such script — the isolation gate lives in `@aiims/testing`. Running `pnpm test:isolation` from root
fails with `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`.

- **CI is unaffected:** `.github/workflows/ci.yml` calls `pnpm --filter @aiims/testing test:isolation` correctly.
- **Recommendation:** repoint the root script to `@aiims/testing` for local parity.

### L-2 · Low · Turbo drops Testcontainers socket override (local DX on colima only)

Root `pnpm test:integration` (`turbo run test:integration`) runs in Turbo's sanitized env and does not
pass `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE` / `DOCKER_HOST`, so on colima the suite **skips** (17 skipped)
rather than runs — a false "green-looking" skip. Running the package script directly passes 17/17.

- **CI is unaffected:** CI reuses a Postgres service via `ISOLATION_DATABASE_URL` (no Testcontainers socket).
- **Risk:** a developer could mistake the Turbo skip for a pass and miss a real integration failure.
- **Recommendation:** add `passThroughEnv: ["DOCKER_HOST","TESTCONTAINERS_*","ISOLATION_DATABASE_URL"]`
  to the `test:integration`/`test:isolation` tasks in `turbo.json`.

### N-1 · Info · `Open-Issues-and-Assumptions.md` is pre-implementation (last updated 2026-07-03)

It tracks architecture-review gaps — notably **D-1** (Founder Context Pack not present) and **D-2** (Volume IV
OCR-corrupted) — and assumptions A-1…A-5. These are legitimately still open but are founder/document items,
not implementation regressions. Consider a short "implementation open items" section or confirm it stays
architecture-scoped.

### N-2 · Info · Historical `note.created.v1` event in the dev outbox

A single `note.created.v1` row predates the note-table retirement (migration 0004). It is dispatched dev
data; **no code path emits or consumes it** and no `note` event schema remains. Harmless; will vanish on a
fresh DB.

---

## 4. Risks

| Risk                                                           | Likelihood | Impact   | Mitigation                                                                            |
| -------------------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------- |
| OpenAPI drift misleads a future client-gen / external consumer | Medium     | Medium   | Fix M-1 before Stage 4; gate OpenAPI completeness in `contracts.test.ts`              |
| Local "Turbo skip = pass" masks an integration failure (L-2)   | Low        | Medium   | `passThroughEnv` in turbo.json; document the direct package command                   |
| AWS deploy path unverified (deferred since Stage 0)            | Known      | Deferred | `deploy-dev` gated on `AWS_DEPLOY_ROLE_ARN`; terraform validates but never `apply`-ed |
| Founder docs D-1/D-2 unresolved (N-1)                          | Known      | Low now  | Re-upload Context Pack + clean Volume IV before Production phase                      |

## 5. Technical debt

- **OpenAPI generator lags implementation by two stages** (M-1) — the only _architectural_ debt; everything
  else is DX polish.
- **Two root convenience scripts diverge from CI reality** (L-1, L-2) — trivial fixes.
- **No end-to-end AWS/staging deploy exercised** — intentional founder deferral; carries forward.
- **Coverage ratchet is crypto-only** — broader package coverage thresholds are not yet enforced (by design;
  grows per stage per TDR-0012). Consider ratcheting `@aiims/authz` and contracts next.

## 6. Architecture drift

**Minimal and non-structural.** Every frozen decision exercised in Stages 0–3 is honored:
dependency-inward layering (BDR-0001/0013), Drizzle confinement (BDR-0003), FORCE RLS fail-closed
(DDR-0002), tenant-scoped composite FKs (DDR-0008), optimistic concurrency (DDR-0009), transactional
outbox (DDR-0007), hash-chained audit (ADR-0005), DTO-only surface (APDR), field encryption for PHI only
(DDR-0006), dark-by-flag FHIR. The **only** drift is the derived OpenAPI artifact not tracking the code
(M-1) — a generation gap, not a design divergence. No new pattern has been introduced that contradicts the
frozen architecture.

## 7. Recommendations before Stage 4

1. **(M-1, do first)** Extend `generate-openapi.ts` with patient + practitioner (+ their FHIR) paths and add
   a `contracts.test.ts` assertion that every mounted controller route appears in the document. Prevents
   further compounding drift.
2. **(L-1)** Repoint root `test:isolation` to `@aiims/testing`.
3. **(L-2)** Add `passThroughEnv` for Docker/Testcontainers vars in `turbo.json`.
4. **(hygiene)** Add a one-line "implementation open items" note to `Open-Issues-and-Assumptions.md` or
   confirm it remains architecture-scoped (N-1).
5. **(optional)** Begin ratcheting coverage thresholds beyond `@aiims/crypto` (authz + contracts are the
   natural next gates).

None of 1–5 is a blocker for _starting_ Stage 4 design, but **M-1 should be closed before Stage 4 ships**
so the API contract artifact is trustworthy when the surface grows again.

---

## Appendix — gate sweep commands & results (this session)

| Gate             | Command                                         | Result                         |
| ---------------- | ----------------------------------------------- | ------------------------------ |
| typecheck        | `pnpm typecheck`                                | 22/22 ✅                       |
| lint (BDR-0013)  | `pnpm lint`                                     | clean ✅                       |
| format           | `pnpm format:check`                             | clean ✅                       |
| build            | `pnpm build`                                    | 13/13 ✅                       |
| unit             | `pnpm test`                                     | 50/50 ✅                       |
| crypto coverage  | `pnpm --filter @aiims/crypto test`              | 98.5% ≥ 90% ✅                 |
| integration      | `pnpm --filter @aiims/testing test:integration` | 17/17 ✅                       |
| isolation        | `pnpm --filter @aiims/testing test:isolation`   | 16/16 ✅                       |
| RLS gate         | `pnpm --filter @aiims/db check:rls`             | all FORCED ✅                  |
| dependency audit | `pnpm audit --prod`                             | no known vulns ✅              |
| compose          | `docker compose config`                         | valid ✅                       |
| terraform        | `terraform fmt -check` + `validate`             | clean + valid ✅               |
| audit chain      | SQL lag() link check                            | 0 breaks / 31 rows ✅          |
| outbox           | SQL dispatch health                             | 19/19 dispatched, 0 pending ✅ |
| migrations       | files vs `schema_migrations`                    | 0000–0008, exact match ✅      |

---

**Status: cumulative verification complete. Awaiting approval. Stage 4 not started; no files modified beyond this report.**
