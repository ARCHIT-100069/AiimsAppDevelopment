# AIIMS+ — Stage 2 (Patient Module) — Independent Verification

**Date:** 2026-07-06 · **Type:** read-only audit (no code modified) · **Ref:** IMPLEMENTATION-MASTER-PLAN §12 + frozen architecture
**Method:** every gate executed; migrations/RLS/encryption/APIs/UI inspected against the frozen records; repo swept for smells.

## Verdict

**Stage 2 is functionally complete and architecturally sound.** All 6 exit criteria pass; encryption,
blind indexing, RLS, audit, RBAC, and the FHIR-dark modification are correctly implemented. **8 issues
found — 0 Critical, 1 High, 2 Medium, 5 Low.** None invalidates a Stage 2 deliverable; the High and one
Medium are CI-gating gaps that should be fixed before Stage 3. Details and fixes below.

## The 20 requested checks

| #   | Check                                       | Result          | Notes                                                                                                                 |
| --- | ------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Every Stage 2 deliverable exists            | ✅ PASS         | clinical.patient, crypto pkg, patient module, mock ABDM M1, FHIR mapper, web UI all present                           |
| 2   | Every exit criterion satisfied              | ✅ PASS         | proven by integration + isolation suites and prior live E2E (§ below)                                                 |
| 3   | APIs match contracts                        | ✅ PASS         | every handler `schema.parse()` at the edge; responses typed to contracts                                              |
| 4   | DB schema/migrations/RLS/indexes/encryption | ✅ PASS         | 0005/0006 correct; 7/7 migrations applied = on disk; FORCE RLS ×3; all indexes present                                |
| 5   | Blind indexes + KeyProvider                 | ✅ PASS         | tenant-salted HMAC; LocalKeyProvider refuses prod; aws-kms fails-fast until bootstrap                                 |
| 6   | Outbox + audit behavior                     | ✅ PASS         | write+outbox+audit atomic in one tx; external ABDM calls OUTSIDE the tx; PHI reads audited                            |
| 7   | RBAC / permission matrix                    | ✅ PASS         | S2-d exact: admin none, doctor r/u, nurse r, front_desk c/r/u, platform_admin none                                    |
| 8   | DTO-only API surface                        | ⚠️ PASS (1 Low) | patient/tenancy/org map explicitly; **reference passes db row types through** (F4)                                    |
| 9   | Patient search behavior                     | ✅ PASS         | trigram name, MRN prefix, blind-index phone/abha, allow-listed (≤1 identifier)                                        |
| 10  | FHIR mapper                                 | ✅ PASS         | `buildFhirPatient` + round-trip tests; HTTP endpoint dark (flag `fhir.read`=false → 404)                              |
| 11  | UI pages and flows                          | ✅ PASS         | login/list/new/detail; BFF PKCE; a11y test 0 violations; `next build` 12 routes                                       |
| 12  | Integration tests                           | ✅ PASS (local) | 11/11 green locally — **but NOT run in CI (F1, High)**                                                                |
| 13  | Isolation tests                             | ✅ PASS         | 14/14 incl. patient id/name/blind-index + cross-tenant digest non-correlation                                         |
| 14  | Contract tests                              | ✅ PASS         | `contracts.test.ts` + `platform.test.ts` (patient DTOs, cursors, OpenAPI surface)                                     |
| 15  | CI pipeline                                 | ⚠️ PARTIAL      | isolation/rls/crypto-coverage/format/audit wired; **integration suite missing (F1)**                                  |
| 16  | Coverage thresholds                         | ✅ PASS         | crypto ≥90% enforced in CI (98.5% actual)                                                                             |
| 17  | Build / lint / typecheck / test             | ⚠️ 1 FAIL       | build 13/13, typecheck 22/22, lint clean, unit 38, integ 11, isol 14 — **`format:check` FAILS (F2)**                  |
| 18  | Smell sweep (TODO/console/dead code…)       | ⚠️ PASS (Lows)  | no TODO/FIXME/console/debugger/.only/.skip/placeholder; **tracked build artifacts (F3), dead exports (F5), dup (F6)** |
| 19  | Stage 0/1 guarantees intact                 | ✅ PASS         | platform isolation + FK graft + idempotency suites still green; RLS gate clean                                        |
| 20  | No frozen decision violated                 | ✅ PASS         | identifiers-only encryption, RLS FORCE, Drizzle-confined, FHIR-at-boundary, KMS seam all honored                      |

## Exit criteria (§12) — evidence

| Criterion                                       | Evidence                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register with encrypted identifiers + mock ABHA | integration `identifiers are CIPHERTEXT at rest` (phone → 41-byte ciphertext, no plaintext substring, 32-byte bidx, `local.` keyref); mock ABHA via `AbdmGateway.createAbha` |
| Search by name / MRN                            | trigram + MRN-prefix helpers; integration `trigram search matches partial names`                                                                                             |
| View / update                                   | GET decrypts; PATCH versioned; integration `optimistic concurrency: stale version updates nothing`                                                                           |
| Tenant-scoped + audited                         | isolation 14/14; audit reads/searches/writes; per-tenant hash chain intact                                                                                                   |
| FHIR regenerable                                | mapper round-trip unit tests; endpoint dark by default                                                                                                                       |
| Isolation suite green                           | 14/14                                                                                                                                                                        |

## Gate results (this run)

```
build            13/13 ✅      typecheck        22/22 ✅
lint (boundaries) clean ✅     format:check     FAIL ❌  (F2)
unit             38 ✅         crypto coverage  98.5% ≥90% ✅
integration      11/11 ✅      isolation        14/14 ✅
rls policy-diff  clean ✅      dep audit        clean ✅
```

---

## Findings

### F1 — CI does not run the integration test suite · **HIGH**

- **Where:** `.github/workflows/ci.yml` (no `test:integration` step in any job).
- **What:** The isolation gate (`test:isolation`) and RLS check run in CI, but the **integration suite**
  (`packages/testing/test/{platform,patient}.spec.ts` — ciphertext-at-rest, envelope round-trip,
  blind-index lookup, tenant-scoped FK graft rejection, optimistic-concurrency 409, idempotency, MRN
  uniqueness) is **never executed by the pipeline**. TDR-0012's gate order explicitly lists
  "integration (RLS)" as a blocking stage; today a regression in encryption/FK/idempotency would pass CI.
- **Impact:** The most security-relevant DB behaviors are only verified on a developer's machine.
- **Fix:** Add a CI job mirroring `isolation-gate` (Postgres service + `ISOLATION_DATABASE_URL`) that runs
  `pnpm --filter @aiims/testing test:integration`, needs `static`, and blocks `docker-build`.

### F2 — `apps/web/app/globals.css` fails `format:check` (breaks CI static job) · **MEDIUM**

- **Where:** `apps/web/app/globals.css`.
- **What:** The file is not Prettier-formatted; `pnpm format:check` (run in the CI `static` job) fails, so
  **the pipeline is currently red**. Introduced by the post-Stage-2 UI redesign commit `f52c454`.
- **Root cause:** see F7 — `*.css` is outside the lint-staged globs, so the pre-commit hook never formatted it.
- **Fix:** `pnpm format` (Prettier `--write`), then commit. (One command; no logic change.)

### F3 — Compiled build artifacts tracked in `packages/design-tokens/src/` · **MEDIUM**

- **Where:** `packages/design-tokens/src/index.js`, `index.d.ts`, `index.js.map`, `index.d.ts.map` (git-tracked).
- **What:** Compiled output committed inside `src/`, left over from the Stage 0 build **before** the
  `${configDir}` outDir fix. The package loads from `dist/index.js`, so these four files are dead, can go
  stale, and pollute the source tree. No other package has this.
- **Impact:** Version-control noise / stale-artifact risk; not a runtime bug.
- **Fix:** `git rm packages/design-tokens/src/index.{js,d.ts,js.map,d.ts.map}`; optionally add
  `packages/*/src/**/*.{js,d.ts,map}` to `.gitignore` to prevent recurrence.

### F4 — Reference module returns db row types instead of mapped DTOs · **LOW**

- **Where:** `apps/api/src/modules/reference/application/reference.service.ts` (returns `CodeSystemRow[]` /
  `ReferenceCodeRow[]`) and `.../api/reference.controller.ts` (`data: rows`).
- **What:** Every other module maps domain/rows → contract DTOs via an explicit `toResponse`. The reference
  path forwards `@aiims/db` row types straight to the wire. Structurally identical to the contract today
  (no extra fields, no PHI), so **safe now** — but if a column is added to those db row types it would leak,
  and it's inconsistent with the DTO-only discipline (founder clarification #1).
- **Fix:** Map to `CodeSystemResponse` / `ReferenceCodeResponse` in the controller (pick fields explicitly).

### F5 — Dead exports `listAuditRows` / `AuditRowView` · **LOW**

- **Where:** `packages/db/src/queries.ts`.
- **What:** Exported but unused anywhere in the repo (the audit-integrity reader they were intended for is a
  Production item, ODR-0011).
- **Fix:** Remove now, or leave with a `// used by the audit verifier (ODR-0011, Stage 9)` note. Recommend
  removing to keep the surface honest.

### F6 — Duplicated BFF header helper · **LOW**

- **Where:** `apps/web/app/api/bff/patients/route.ts` (`passthrough`) and
  `apps/web/app/api/bff/patients/[id]/route.ts` (`ct`) — two near-identical content-type passthrough helpers.
- **Fix:** Extract one helper into `apps/web/app/lib/` and import it in both routes.

### F7 — lint-staged globs omit `*.css` (process gap enabling F2) · **LOW**

- **Where:** `package.json` → `lint-staged`.
- **What:** Only `*.{ts,tsx,mjs,js}` and `*.{json,md,yml,yaml}` are covered; CSS/SCSS files skip pre-commit
  Prettier, so they silently drift from the CI `format:check`.
- **Fix:** Add `"*.{css,scss}": ["prettier --write"]` to the lint-staged config.

### F8 — ABHA blind-index search path lacks an automated test · **LOW**

- **Where:** `packages/testing/test/patient.spec.ts` (covers **phone** blind index, not **abha**).
- **What:** The phone blind-index lookup is tested; the ABHA lookup uses the same mechanism but has no
  explicit assertion. Minor coverage gap on a security-relevant path.
- **Fix:** Add an "insert with ABHA → find by abha blind index" case to the integration suite.

---

## Not findings (verified expected behavior)

- `platform.note` is **created in migration 0000 and dropped in 0004** — correct immutable, forward-only
  migration history (DDR-0011); a fresh DB creates then drops it. The only remaining `note` references are
  that historical migration plus two incidental English "note:" comments.
- **Mock adapters still present** (ABDM/consent/payment/notification/AI) — required by ADR-0010; not stale code.
- `packages/ui-native` scaffold and `apps/{mobile,ai}` stubs — intentional per Master Plan §4 / AIDR-0003.
- **No ciphertext leaks to the API:** the patient DTO mapper exposes no `*_enc`/`*_bidx`/`enc_key_ref` fields
  (the domain aggregate holds plaintext only; encryption lives in the repository).

## Frozen-architecture conformance (check 20) — all honored

DDR-0006 identifiers-only field encryption + blind index ✓ · SDR-0005 KMS-ready via KeyProvider seam ✓ ·
DDR-0002 FORCE RLS fail-closed on all clinical tables ✓ · ADR-0011/BDR-0003 Drizzle confined to
`packages/db` (crypto is pure `node:crypto`) ✓ · ADR-0003/APDR-0012 FHIR only at its boundary, dark ✓ ·
BDR-0004 one-tx write+outbox+audit, no external calls in the UoW ✓ · SDR-0004 no PHI in events/logs/telemetry ✓ ·
ADR-0006 mock ABDM M1 behind the port ✓ · SDR-0002 RBAC separation of duties ✓. No frozen decision reopened;
the nine S2 decisions were approved additions/realizations.

## Recommendation

Fix **F1 (High)** and **F2/F3 (Medium)** before Stage 3 — F1 closes a real CI gate gap and F2 currently
makes the pipeline red. The five Lows are cleanups that can be batched. No Stage 2 rework is required.
