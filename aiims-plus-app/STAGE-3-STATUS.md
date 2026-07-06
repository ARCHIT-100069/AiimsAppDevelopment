# AIIMS+ — Stage 3 (Practitioner Module) — Status & Verification Report

**Date:** 2026-07-06 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §13
**Purpose:** map every Stage 3 deliverable, exit criterion, and DoD item to verification evidence.
Stage 3 adds the **clinical practitioner directory** layered over `platform.app_user`. All Stage 0/1/2
guarantees preserved (DTO-only APIs, tenant isolation, FORCE RLS, hash-chained audit, transactional
outbox, optimistic concurrency, boundary rules, blocking CI gates). **Stage 4 NOT started.**

## Deliverables (Master Plan §13)

| Deliverable                                                 | Status      | Evidence                                                                                                                                           |
| ----------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinical.practitioner` (FHIR Practitioner shape, DDR-0005) | ✅ Verified | Migration 0007; hot columns + `specialty_codings` jsonb + `fhir_extensions`; FORCE RLS + grants (0008); isolation gate green                       |
| Practitioner over an existing `app_user` (decision a)       | ✅ Verified | `app_user_id` required + tenant-scoped composite FK (DDR-0008); **live: create links a real user, name defaults from `display_name` (decision c)** |
| Immutable login link (founder requirement)                  | ✅ Verified | Update DTO has **no** `appUserId`; `updatePractitionerVersioned` never sets it; **live: PATCH with `appUserId` in body left the link unchanged**   |
| Registration + directory APIs (APDR contracts)              | ✅ Verified | `POST/GET/PATCH /v1/practitioners` + allow-listed search live; DTO-only                                                                            |
| Practitioner search (name / registration / department)      | ✅ Verified | trigram name search live; allow-list rejects >1 filter (APDR-0005)                                                                                 |
| Specialty reference codes (decision b, dev-minimal)         | ✅ Verified | `specialty` code system + 8 codes seeded; `GET /v1/reference/codes?system=specialty` → 8                                                           |
| Non-blocking clinical-role warning (decision i, modified)   | ✅ Verified | **live: linking a `front_desk` user → 201 + `LINKED_USER_NOT_CLINICAL`**, audit `practitioner.role_warning`, outbox `practitioner.role_warning.v1` |
| FHIR Practitioner mapper, dark by flag (decision h)         | ✅ Verified | `buildFhirPractitioner` + round-trip unit test; **live: 404 while `fhir.read` false; flag on → 200 valid resource; reverted to false**             |
| Practitioner UI in `web` (auth-aware, FEDR-0008)            | ✅ Verified | BFF proxies; directory/add/detail; admin-gated create; role-warning banner; `next build` green; a11y test 0 violations                             |

## Exit criteria (Master Plan §13) — demonstrated live on compose

| Criterion                                       | Status | Evidence                                                                                                          |
| ----------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Register a practitioner linked to an app_user   | ✅     | admin `POST /v1/practitioners` (doctor user) → **201**, version 0, name defaulted "Dr. Asha Demo", `warnings: []` |
| Name defaults from the linked user (decision c) | ✅     | no `nameGiven/Family` supplied → resolved from `app_user.display_name` live                                       |
| View / update; link stays immutable             | ✅     | GET → 200; PATCH name+status `If-Match: 0` → 200 (version 1); PATCH with forged `appUserId` → link **unchanged**  |
| Duplicate registration rejected                 | ✅     | second create with same `registrationNo` → **409** (tenant-scoped unique); same number free in tenant B (integ.)  |
| Optimistic concurrency                          | ✅     | stale `If-Match: 0` after update → **409** (DDR-0009)                                                             |
| All tenant-scoped + audited                     | ✅     | audit chain **INTACT, 0 breaks / 21 rows tenant A**; create/read/update/role_warning all audited                  |
| Cross-tenant FK graft rejected (DDR-0008)       | ✅     | integration: linking tenant B's `app_user` under tenant A → **foreign-key violation**                             |
| FHIR Practitioner regenerable                   | ✅     | mapper + round-trip test; HTTP endpoint **DARK by default** (`fhir.read` false) → 404; on → valid Practitioner    |
| Isolation suite green                           | ✅     | **16/16** incl. practitioner id/name/registration probes + WITH CHECK forgery rejection                           |

## Additional proofs (beyond the criteria)

- **RBAC (decision e):** admin `practitioner:manage`; all clinical roles + `front_desk` get `practitioner:read`.
  **Live: doctor POST → 403, front_desk POST → 403, front_desk GET → 200.**
- **No PHI in events:** outbox payloads carry `practitionerId`/`appUserId`/`version` only — verified in the DB.
- **Registration number is NOT encrypted (decision d):** stored plaintext as a professional credential, not PHI.
- **Outbox events emitted:** `practitioner.created.v1` ×2, `practitioner.updated.v1` ×2, `practitioner.role_warning.v1` ×1.
- **No Idempotency-Key on create (decision g):** duplicate-safe via the natural registration-number unique → 409.

## Gate sweep (all green)

| Gate                        | Result                                                                                                              | Command                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| build / typecheck           | 13/13 · 22/22                                                                                                       | `pnpm build` · `pnpm typecheck`   |
| lint (boundaries) + format  | clean · clean                                                                                                       | `pnpm lint` · `pnpm format:check` |
| unit tests                  | **50** (crypto 11, contracts 14, authz 10, api 6, events 4, config 3, web-a11y 2)                                   | `pnpm test`                       |
| integration (real Postgres) | **17** (Stage 1 ×5, Stage 2 ×6, **Stage 3 ×5**: FK graft, duplicate→409, immutable link, concurrency, role warning) | `test:integration`                |
| **isolation gate**          | **16/16** (+2 practitioner cross-tenant probes)                                                                     | `test:isolation`                  |
| dependency audit            | No known vulnerabilities                                                                                            | `pnpm audit --prod`               |
| RLS policy-diff             | all present/enabled/FORCED (incl. `clinical.practitioner`)                                                          | `check:rls`                       |

**Test totals:** 50 unit + 17 integration + 16 isolation = **83**.

## Definition of Done (§20)

| DoD item                                   | Status                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — decisions a–i were approved additions/realizations; no frozen decision changed         |
| Unit + integration + contract tests green  | ✅ 50 + 17; contract tests validate practitioner DTOs (immutable link, warnings, search)    |
| **Isolation suite green**                  | ✅ 16/16                                                                                    |
| No PHI in logs/telemetry; audit emitted    | ✅ references-only events; PHI-free directory; clinical reads audited (`practitioner.read`) |
| Deployed to staging                        | ⏳ AWS-gated (carried from Stage 0/1/2, founder-deferred)                                   |
| Exit criteria demoed                       | ✅ this report + live E2E on compose (12-step flow, all assertions passed)                  |
| Docs updated                               | ✅ this report                                                                              |

## Founder-approved decisions honored

- **a** app_user link required · **b** specialty codes dev-minimal (8) · **c** name defaults from `display_name`
- **d** registration_no NOT encrypted · **e** manage→admin, read→all clinical + front_desk · **f** single department
- **g** no Idempotency-Key on create (duplicate-safe natural key → 409) · **h** FHIR endpoint dark behind `fhir.read`
- **i (modified):** a non-clinical linked user does **not block** creation — it returns a structured
  `LINKED_USER_NOT_CLINICAL` warning, writes an audit event, and surfaces a UI banner. **Verified live.**
- **Immutable link (added requirement):** `app_user_id` can never be reassigned. Enforced in the domain
  (no mutator), the update query (never sets it), and the update DTO (no field). **Verified live** — a
  PATCH carrying `appUserId` left the link intact.

## Deviations & notes

- **`vitest.integration.config.ts`** now lists `test/practitioner.spec.ts` explicitly (the config uses an
  allow-list, not a glob) so the new suite runs in the blocking `integration-gate` CI job (TDR-0012).
- **PHI-read auditing:** practitioner GET emits a standalone `practitioner.read` audit row (no outbox
  event — reads are not domain events), consistent with the Stage 2 pattern.
- **FHIR flag toggle** during verification was reverted; `platform.feature_flag('fhir.read')` is `false`.

## Commits (Stage 3)

| Commit    | Scope                                                          |
| --------- | -------------------------------------------------------------- |
| `023a0b3` | contracts, events, FHIR mapper                                 |
| `a40a59d` | db — migrations 0007/0008 + queries + specialty seed           |
| `c443532` | api module — authz, audited flows, advisory warning, dark FHIR |
| `a7a8c05` | web — directory, add form, detail, sidebar nav                 |
| `67d2efc` | tests — unit, contract, integration, isolation probes          |

---

**Stage 3 is complete and verified. Awaiting approval before Stage 4.**
