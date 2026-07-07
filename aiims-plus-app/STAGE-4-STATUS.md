# AIIMS+ — Stage 4 (Appointments / OPD) — Status & Verification Report

**Date:** 2026-07-07 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §14
**Purpose:** map every Stage 4 deliverable, exit criterion, and DoD item to verification evidence.
Stage 4 adds **OPD scheduling**: appointments with **DB-enforced no double-booking**, check-in that opens a
clinical **encounter** (the Stage 5/6 anchor), and an OPD queue. All Stage 0–3 guarantees preserved
(DTO-only APIs, tenant isolation, FORCE RLS, hash-chained audit, transactional outbox, optimistic
concurrency, composite FKs, dark-by-flag FHIR, blocking CI gates). **Stage 5 NOT started.**

## Deliverables (Master Plan §14)

| Deliverable                                                                      | Status      | Evidence                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SchedulingModule` + `clinical.appointment` (FHIR Appointment, DDR-0005)         | ✅ Verified | Migration 0009; NestJS module; DTO-only; **live E2E** book→check-in                                                                                                               |
| **Slot exclusion constraint** preventing double-booking (`btree_gist`, DDR-0009) | ✅ Verified | `EXCLUDE USING gist (tenant_id=, practitioner_id=, slot &&)` partial on active statuses; **integration: 6 concurrent bookings → exactly 1 wins, 5×23P01**; live double-book → 409 |
| book / reschedule / cancel / no-show                                             | ✅ Verified | endpoints live; reschedule/cancel/no-show use If-Match; **live: no-show freed the slot (rebook 201)**                                                                             |
| check-in → open `clinical.encounter`                                             | ✅ Verified | one tx: token + `checked_in` + encounter (`AMB`, `in_progress`); **live: encounter opened, linked to appointment**                                                                |
| scheduling UI (front-desk role)                                                  | ✅ Verified | `/appointments` console (book/check-in/cancel/no-show) + `/appointments/queue` board; a11y test 0 violations                                                                      |

## Exit criteria (Master Plan §14) — demonstrated live on compose

| Criterion                                | Status | Evidence                                                                                                       |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Front-desk books a patient with a doctor | ✅     | `front_desk POST /v1/appointments` (Idempotency-Key) → **201**, status booked                                  |
| **Double-booking is rejected by the DB** | ✅     | same slot again → **409**; **integration proves it under concurrency** (exactly one of N wins)                 |
| reschedule / cancel / no-show work       | ✅     | reschedule If-Match:0 → 200 (v1); stale → **409**; cancel → 200; no-show → 200 (slot freed)                    |
| check-in opens an encounter              | ✅     | check-in → 200 + `encounterId` + `queueToken`; `GET /v1/encounters/{id}` → AMB / in_progress                   |
| audited                                  | ✅     | audit chain **INTACT, 0 breaks / 47 rows**; book/reschedule/cancel/no_show/check_in/read + encounter.open/read |
| Isolation suite green                    | ✅     | **17/17** incl. appointment/encounter cross-tenant read + WITH CHECK forgery probes                            |

## Additional proofs (beyond the criteria)

- **RBAC (D-4.7 separation of duties):** reception books/checks-in; admin configures schedules; all clinical read.
  **Live: doctor POST → 403, admin POST → 403, front_desk POST → 201.**
- **Idempotent check-in (APDR-0006):** replay with the same key returned the **same encounter + token** (live).
- **Optimistic concurrency (DDR-0009):** stale `If-Match` → 409, distinct from the slot-conflict 409.
- **Cross-tenant composite FK (DDR-0008):** booking with another tenant's practitioner → FK violation (integration).
- **Gap-free queue tokens (D-4.3):** 15 concurrent issuances → 15 unique, max 15 (integration); live token #1 shown on the queue board.
- **Computed free slots (D-4.2):** availability template → 6 slots live; booking one removes it (integration).
- **FHIR Appointment (dark, decision h):** 404 while `fhir.read` false; flag on → valid `Appointment` (status `arrived`, both participants); reverted.
- **No PHI in events:** outbox payloads carry ids/version only — `appointment.booked/rescheduled/cancelled/no_show/checked_in.v1`, `encounter.opened.v1`.

## Forward-compatibility (Encounter / EMR / Billing / Pharmacy / Lab)

The **encounter skeleton** (decision D-4.1) is the anchor future modules attach to — `clinical.encounter (tenant_id, id)`
is a composite-FK target; `appointment_id` is **nullable** so walk-ins (D-4.8) need no redesign. Stage 5 EMR
_extends_ the encounter with documentation children (notes/observations/conditions/orders) and the sign
lifecycle; Stage 6 Billing invoices the encounter. The appointment/encounter model does not need to change.

## Gate sweep (all green)

| Gate                                            | Command                                 | Result                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| format · build · typecheck                      | `pnpm format:check · build · typecheck` | clean · 13/13 · 22/22                                                                                                                                     |
| lint (BDR-0013 boundaries)                      | `pnpm lint`                             | clean                                                                                                                                                     |
| unit (incl. contract + M-1 route-coverage gate) | `pnpm test`                             | **65** (contracts 19, api 14, authz 11, crypto 11, events 4, config 3, web 3)                                                                             |
| crypto coverage                                 | `pnpm --filter @aiims/crypto test`      | 98.5% ≥ 90%                                                                                                                                               |
| integration (real Postgres)                     | `test:integration`                      | **25** (Stage 1–3 ×17, **Stage 4 ×8**: concurrent double-book, adjacent-ok, reschedule-overlap, check-in→encounter, concurrency, FK graft, tokens, slots) |
| **isolation gate**                              | `test:isolation`                        | **17/17** (+ appointment/encounter probes)                                                                                                                |
| RLS policy-diff                                 | `check:rls`                             | all present/enabled/FORCED (incl. 4 new tables)                                                                                                           |

**Test totals:** 65 unit + 25 integration + 17 isolation = **107**. OpenAPI paths: **26** (all Stage 4 routes covered by the M-1 gate).

## Definition of Done (§20)

| DoD item                                   | Status                                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — decisions D-4.1…D-4.9 are approved realizations; no frozen decision changed                           |
| Unit + integration + contract tests green  | ✅ 65 + 25; contract tests validate appointment DTOs + FHIR mapper                                         |
| **Isolation suite green**                  | ✅ 17/17                                                                                                   |
| No PHI in logs/telemetry; audit emitted    | ✅ reference-only events; clinical reads audited; chain intact                                             |
| Deployed to staging                        | ⏳ AWS-gated (carried from Stage 0–3, founder-deferred)                                                    |
| Exit criteria demoed                       | ✅ this report + live E2E on compose (book→double-book→RBAC→check-in→queue→reschedule/cancel/no-show→FHIR) |
| Docs updated                               | ✅ this report                                                                                             |

## Decisions realized (D-4.1…D-4.9)

- **D-4.1** encounter skeleton created now · **D-4.2** slots computed (facility tz), not materialized · **D-4.3** queue = query + gap-free tokens
- **D-4.4** notifications via the existing mock adapter seam (outbox-driven; real delivery Stage 8) · **D-4.5** `appointment:advance` dropped (in_progress arrives in Stage 5 EMR — keeps the 6 registered events tight)
- **D-4.6** `reason_text` not encrypted (low-sensitivity; diagnosis lives in the S5 encounter) · **D-4.7** RBAC: reception books, admin configures, all read
- **D-4.8** walk-ins schema-ready (nullable `encounter.appointment_id`), feature deferred · **D-4.9** Idempotency-Key required on book + check-in

## Deviations & notes

- **Timezone (MVP):** appointments store `timestamptz` UTC (DB §4); availability local times are expanded to
  instants via the **facility timezone**; the queue/day windows treat the calendar date as a UTC day. Full
  facility-local day boundaries can be refined later without a schema change.
- **`computeFreeSlots` fix:** raw-SQL `timestamptz` came back as strings; coerced to `Date` at the query
  boundary (caught by the integration slot test).
- **FHIR Encounter** mapping is deferred to Stage 5 (the skeleton is not documentation-complete yet); only
  FHIR **Appointment** is mapped in Stage 4, dark by flag.

## Commits (Stage 4)

| Commit    | Scope                                                                 |
| --------- | --------------------------------------------------------------------- |
| `e94da1a` | contracts, events, FHIR Appointment mapper                            |
| `1c94ccb` | db — migrations 0009/0010 + scheduling queries + exclusion constraint |
| `50e17a5` | api module — authz, booking/check-in/queue, dark FHIR                 |
| `90053e7` | web — scheduling console + OPD queue board                            |
| `f9931ef` | tests — unit, integration, isolation probes (+ computeFreeSlots fix)  |

---

**Stage 4 is complete and verified. Awaiting approval before Stage 5.**
