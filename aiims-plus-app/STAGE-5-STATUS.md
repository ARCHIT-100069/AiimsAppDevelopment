# AIIMS+ — Stage 5 (EMR) — Status & Verification Report

**Date:** 2026-07-07 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §15
**Purpose:** map every Stage 5 deliverable, exit criterion, and DoD item to verification evidence.
Stage 5 is **the clinical heart**: a doctor documents an OPD encounter (notes/vitals/diagnosis), places
orders, records results, and **signs**; amendments create new versions; the encounter is regenerable as a
FHIR Bundle. **Constitution-bound: sign is human/doctor-only; no AI in the EMR.** All Stage 0–4 guarantees
preserved (DTO-only, tenant isolation, FORCE RLS, hash-chained audit, transactional outbox, optimistic
concurrency, composite FKs, dark-by-flag FHIR, CI gates). **Stage 6 NOT started.**

## Deliverables (Master Plan §15)

| Deliverable                                                        | Status      | Evidence                                                                                                                            |
| ------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `clinical.encounter` sign/finalize lifecycle (FHIR Encounter)      | ✅ Verified | migration 0011 extends the Stage 4 skeleton (chief_complaint/signed_at/signed_by); **live: sign → finished, signedBy/signedAt set** |
| `clinical_note` — signed docs, **versioned amendments** (DDR-0013) | ✅ Verified | append-only table (INSERT+SELECT only); **live + integration: amend → v2 supersedes v1, both retained**; list shows latest only     |
| `observation` (vitals, LOINC)                                      | ✅ Verified | LOINC-coded; **live: temperature 38.7 Cel recorded**                                                                                |
| `condition` (diagnosis, ICD-10/SNOMED)                             | ✅ Verified | **live: J06.9 Acute URI recorded**                                                                                                  |
| `orders.service_request` + `orders.diagnostic_report`              | ✅ Verified | new `orders` schema; **live: order placed, result filed; integration: order→result composite FK**                                   |
| Large files to object storage via **presigned URLs** (APDR-0007)   | ✅ Verified | new `StorageGateway` adapter (mock=MinIO); **live: presign returns tenant-scoped key `t/<tenant>/…` + MinIO URL + 900s expiry**     |
| EMR UI with **sign/finalize** (doctor-only, Constitution)          | ✅ Verified | `/encounters/[id]` workspace; Sign panel doctor-only + attestation; a11y test 0 violations                                          |

## Exit criteria (Master Plan §15) — demonstrated live on compose

| Criterion                                                        | Status | Evidence                                                                                                                                                    |
| ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A doctor documents a full OPD encounter (notes/vitals/diagnosis) | ✅     | chief complaint (PATCH If-Match), observation, condition, note all 201 live                                                                                 |
| places orders, records results                                   | ✅     | order 201 → result 201 (DiagnosticReport `final`, linked to the ServiceRequest)                                                                             |
| and **signs**                                                    | ✅     | `POST /v1/encounters/{id}/sign` (attestation, doctor) → 200 finished; **attestation:false → 422**                                                           |
| amendments create new versions                                   | ✅     | post-sign `POST /v1/notes/{id}/amend` → 201 **v2** (supersedes v1, reason recorded); prior version retained                                                 |
| FHIR bundle regenerable                                          | ✅     | `$everything` → collection Bundle with 6 resources (Encounter+Observation+Condition+DocumentReference+ServiceRequest+DiagnosticReport); dark by `fhir.read` |
| audited                                                          | ✅     | audit chain **INTACT, 0 breaks / 71 rows**; document/sign/note/observation/condition/order/result/attachment all audited                                    |
| isolation suite green                                            | ✅     | **18/18** incl. clinical_note/observation/condition/orders cross-tenant read + WITH CHECK forgery                                                           |

## Constitution compliance (§15 risk)

- **Sign is human/doctor-only.** RBAC grants `encounter:sign` to **doctor only**; **live: admin sign → 403,
  front_desk → 403**; the request requires an explicit `attestation: true` (**false → 422**).
- **No AI in the EMR.** A static **Constitution gate** test scans every EMR source file and asserts none
  references the AI gateway seam (`AI_GATEWAY`/`AiGateway`). CI fails if AI is ever imported into the clinical heart.

## Additional proofs (beyond the criteria)

- **Sign freezes documentation (defence in depth):** post-sign note write → **409**; chief-complaint edit →
  **409** (service rule + a DB `status='in_progress'` guard on the update). Amendments are the only post-sign path.
- **RBAC (D-5.6):** doctor documents/signs/orders/files; **nurse documents (vitals) but cannot sign/order/file**;
  results readable across clinical + reception (authz matrix test).
- **Cross-tenant integrity (DDR-0008):** filing a result against another tenant's order, and documenting
  against another tenant's encounter, are both rejected (integration).
- **No PHI in events:** outbox payloads carry ids/version only — `encounter.signed.v1`,
  `clinical_note.created/amended.v1`, `observation/condition.recorded.v1`, `service_request.placed.v1`,
  `diagnostic_report.filed.v1`.
- **Bytes never touch the API:** attachments use presigned PUT/GET; the API stores only the object key + hash.

## Forward-compatibility

The encounter remains the anchor (Stage 4's `D-4.1`): Stage 6 Billing will invoice `clinical.encounter`
and its `orders.service_request`/`diagnostic_report`. The `orders` schema and the append-only note model
extend cleanly to Pharmacy/Lab later. No prior model was redesigned.

## Gate sweep (all green)

| Gate                                                 | Command                                 | Result                                                                                                              |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| format · build · typecheck                           | `pnpm format:check · build · typecheck` | clean · 13/13 · 22/22                                                                                               |
| lint (BDR-0013 boundaries)                           | `pnpm lint`                             | clean                                                                                                               |
| unit (incl. contract + M-1 gate + Constitution gate) | `pnpm test`                             | **79** (contracts 26, api 19, authz 12, crypto 11, events 4, config 3, web 4)                                       |
| crypto coverage                                      | `pnpm --filter @aiims/crypto test`      | 98.5% ≥ 90%                                                                                                         |
| integration (real Postgres)                          | `test:integration`                      | **30** (Stage 1–4 ×25, **Stage 5 ×5**: amend/retain, sign-freeze, concurrency, order→result FK, cross-tenant graft) |
| **isolation gate**                                   | `test:isolation`                        | **18/18** (+ EMR/orders probes)                                                                                     |
| RLS policy-diff                                      | `check:rls`                             | all present/enabled/FORCED (incl. 6 new tables + `orders` schema)                                                   |

**Test totals:** 79 unit + 30 integration + 18 isolation = **127**. OpenAPI paths: **39** (all Stage 5 routes covered by the M-1 gate).

## Definition of Done (§20)

| DoD item                                   | Status                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — decisions D-5.1…D-5.9 are approved realizations; no frozen decision changed                   |
| Unit + integration + contract tests green  | ✅ 79 + 30; contract tests validate EMR DTOs + FHIR Encounter/bundle mappers                       |
| **Isolation suite green**                  | ✅ 18/18                                                                                           |
| No PHI in logs/telemetry; audit emitted    | ✅ reference-only events; every clinical read/write audited; chain intact                          |
| Deployed to staging                        | ⏳ AWS-gated (carried from Stage 0–4, founder-deferred)                                            |
| Exit criteria demoed                       | ✅ this report + live E2E on compose (document→order→result→presign→sign→freeze→amend→FHIR bundle) |
| Docs updated                               | ✅ this report                                                                                     |

## Decisions realized (D-5.1…D-5.9)

- **D-5.1** `orders` schema · **D-5.2** append-only note versions (DDR-0013) · **D-5.3** sign finalizes the
  encounter + locks children (amend-only after) · **D-5.4** StorageGateway mock = local MinIO presign (AWS S3 = Stage 8),
  tenant-scoped keys · **D-5.5** small note bodies inline, large files via attachment presign
- **D-5.6** RBAC: doctor documents/signs/orders/files; nurse documents (vitals) only; sign doctor-only
- **D-5.7** clinical free-text stored under RLS+tenant keys, not field-encrypted in MVP (identifiers-only
  scope per DDR-0006; at-rest encryption of clinical text is a hardening-stage item)
- **D-5.8** FHIR Encounter + `$everything` bundle, dark by flag · **D-5.9** no AI in the EMR (Constitution gate test)

## Deviations & notes

- **Storage presign is a mock** (deterministic MinIO-pointing URL): it proves the direct-to-storage flow
  (tenant-scoped key, expiry, no API byte-proxying) without AWS; real S3/MinIO signature v4 is Stage 8 behind
  the same `StorageGateway` seam. Actual byte transfer is not exercised in MVP.
- **Clinical free-text at rest** is protected by RLS + tenant-scoped keys but is not field-encrypted (D-5.7).
- **FHIR** mapping is a demoable, schema-valid projection (not full R4 profiling); Encounter + `$everything` only, dark by flag.

## Commits (Stage 5)

| Commit    | Scope                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| `4cdbdf7` | contracts, events, FHIR Encounter + bundle mapper                                              |
| `c68faa2` | db — migrations 0011/0012 + EMR queries + orders schema                                        |
| `1a2fc94` | api module — StorageGateway adapter, authz, document/sign/orders/results/attachments/dark FHIR |
| `adfe229` | web — EMR encounter workspace + sign                                                           |
| `c02f328` | tests — unit, Constitution gate, integration, isolation probes                                 |

---

**Stage 5 is complete and verified. Awaiting approval before Stage 6 (Billing) — which completes the demoable OPD golden path.**
