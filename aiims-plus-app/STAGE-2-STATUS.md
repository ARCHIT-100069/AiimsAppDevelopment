# AIIMS+ — Stage 2 (Patient Module) — Status & Verification Report

**Date:** 2026-07-06 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §12
**Purpose:** map every Stage 2 deliverable, exit criterion, and DoD item to verification evidence.
First PHI-bearing stage: encryption, blind indexing, and audited clinical access are real now. All
Stage 0/1 guarantees preserved. **Stage 3 NOT started.**

## Deliverables (Master Plan §12)

| Deliverable                                                   | Status      | Evidence                                                                                                                                                     |
| ------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `clinical.patient` (FHIR Patient shape, DDR-0005)             | ✅ Verified | Migration 0005; hot columns + `fhir_extensions`; FORCE RLS (0006); isolation gate green                                                                      |
| Field-encrypted identifiers + blind index (DDR-0006/SDR-0004) | ✅ Verified | `@aiims/crypto` AES-256-GCM envelope, AAD-bound; **live: phone stored as 41-byte ciphertext, no plaintext substring, 32-byte blind index, `local.` key ref** |
| Registration + demographics APIs (APDR contracts)             | ✅ Verified | `POST/GET/PATCH /v1/patients` live; DTO-only                                                                                                                 |
| Patient search (Postgres FTS, Blueprint §17)                  | ✅ Verified | trigram name, MRN prefix, blind-index phone/ABHA — all returned the patient live                                                                             |
| Mock ABDM M1 ABHA create/verify behind the adapter (ADR-0006) | ✅ Verified | `requestAbha` produced synthetic ABHA `99716314638014` via the port; `patient.abha_linked.v1` emitted                                                        |
| Patient UI in `web` (auth-aware, FEDR-0008)                   | ✅ Verified | BFF PKCE auth; list/search/new/detail; `next build` = 12 routes; a11y test 0 violations                                                                      |

## Exit criteria (Master Plan §12) — demonstrated live on compose

| Criterion                                                   | Status | Evidence                                                                                                                                 |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Register a patient with encrypted identifiers + (mock) ABHA | ✅     | front_desk POST → 201, MRN-000001, synthetic ABHA; **ciphertext-at-rest proven by raw row inspection**                                   |
| Search by name / MRN                                        | ✅     | `?q=Meer` → 1 hit; `?mrn=MRN-000001` → 1 hit                                                                                             |
| View / update                                               | ✅     | GET returns decrypted demographics; PATCH v0 → 200 (version bump)                                                                        |
| All tenant-scoped + audited                                 | ✅     | doctor.b GET tenant-A patient → 404 (RLS); audit chain **INTACT, 17 rows across 2 tenants** incl. register/abha_link/read/search/update  |
| FHIR Patient regenerable                                    | ✅     | `buildFhirPatient` mapper + round-trip unit tests; HTTP endpoint **DARK by default** (`fhir.read` false) → 404, per founder modification |
| Isolation suite green                                       | ✅     | **14/14** incl. patient id/name/blind-index probes + cross-tenant digest non-correlation (S2-f)                                          |

## Additional proofs (beyond the criteria)

- **Idempotency (APDR-0006):** replay of the same key → 200 original resource; missing key → 422.
- **Optimistic concurrency (DDR-0009):** stale `If-Match: 0` after an update → **409**.
- **RBAC S2-d matrix:** admin `POST /v1/patients` → **403** (admin holds NO patient permission).
- **No PHI in events:** outbox payloads carry `patientId`/`version`/`provider` only — verified in the DB.
- **KeyProvider seam (S2-b):** `LocalKeyProvider` refuses `NODE_ENV=production`; `aws-kms` mode fails
  fast until AWS bootstrap — same `enc_key_ref` format, no call-site change.

## Gate sweep (all green)

| Gate                                     | Result                                                                          | Command                            |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| build / typecheck                        | 13/13 · 22/22                                                                   | `pnpm build` · `pnpm typecheck`    |
| lint (boundaries) + format               | clean · clean                                                                   | `pnpm lint` · `pnpm format:check`  |
| unit tests                               | **38** (crypto 11, authz 9, contracts 8, events 4, config 3, api 2, web-a11y 1) | `pnpm test`                        |
| **crypto coverage gate (TDR-0012/S2-i)** | **98.5% ≥ 90%**                                                                 | `pnpm --filter @aiims/crypto test` |
| integration (real Postgres)              | **11** (Stage 1 × 5 + Stage 2 × 6)                                              | `test:integration`                 |
| **isolation gate**                       | **14/14**                                                                       | `test:isolation`                   |
| dependency audit                         | No known vulnerabilities                                                        | `pnpm audit --prod`                |
| RLS policy-diff                          | present/enabled/FORCED                                                          | `check:rls`                        |

## Definition of Done (§20)

| DoD item                                   | Status                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — decisions S2-a…S2-i were approved additions/realizations, no frozen decision changed |
| Unit + integration + contract tests green  | ✅ 38 + 11; contract tests validate patient DTOs + OpenAPI                                |
| **Isolation suite green**                  | ✅ 14/14                                                                                  |
| Coverage policy                            | ✅ crypto ≥90% enforced in CI; broader ratchet grows per stage                            |
| No PHI in logs/telemetry; audit emitted    | ✅ references-only events; OTel spans exclude statement values; **PHI reads audited**     |
| Deployed to staging                        | ⏳ AWS-gated (carried from Stage 0/1, founder-deferred)                                   |
| Exit criteria demoed                       | ✅ this report + live E2E                                                                 |
| Docs updated                               | ✅ this report; env template                                                              |

## Founder modification honored

**Public FHIR endpoint not exposed.** The mapper, contract, and tests are fully implemented; the
HTTP surface `/fhir/R4/Patient/{id}` is gated behind the `fhir.read` flag **seeded `false`** and
returns 404 when disabled (verified live). It flips on only when the planned FHIR stage schedules it.

## Bugs found & fixed during verification

1. **Malformed dev key in `.env.example`** — `AIIMS_FIELD_MASTER_KEY` was 63 hex chars; the API
   correctly **refused to boot** (BDR-0011 fail-fast working as designed), but it would have broken
   every developer's first run. Replaced both keys with freshly generated valid 64-char values in
   `.env.example` and `.env`. Re-verified: API boots, full E2E green.

## Deviations & notes

- **PHI-read auditing:** reads/searches emit standalone audit rows (no outbox event — reads aren't
  state changes per DDR-0007), extending "everything auditable" (Blueprint §21) to PHI access.
- **India-profile FHIR field audit** (DB Arch §19.1) remains a tracked open item; `fhir_extensions`
  guarantees representability until it's done (before real ABDM, Stage 8).
- **`aiims_readonly` gets no clinical grant** in Stage 2 — analytics over PHI needs its own review.

## Stage 3 readiness

Patient entity, encryption seam, mock ABDM M1, audited clinical access, and the auth-aware UI are in
place — the prerequisites for Stage 3 (Doctor/Practitioner module). **Stage 3 has not been started.**
