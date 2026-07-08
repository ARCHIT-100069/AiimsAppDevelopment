# AIIMS+ — Stage 6 (Billing) — Status & Verification Report

**Date:** 2026-07-08 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §16
**Purpose:** map every Stage 6 deliverable, exit criterion, and DoD item to verification evidence.
Stage 6 invoices an encounter, takes (mock) payment, and (mock) shares the care context on consent —
**completing the demoable OPD golden path (Milestone B)**. All Stage 0–5 guarantees preserved (DTO-only,
tenant isolation, FORCE RLS, hash-chained audit, transactional outbox, optimistic concurrency, composite
FKs, dark-by-flag FHIR, adapter seams, CI gates). **Stages 7–9 gated on founder/external decisions (see below).**

## Deliverables (Master Plan §16)

| Deliverable                                                                    | Status      | Evidence                                                                                                                                                        |
| ------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing.invoice` + `invoice_line`                                             | ✅ Verified | migration 0013; one invoice per encounter (UNIQUE); money `numeric(12,2)` (never float, DB §4)                                                                  |
| Charge capture from encounter/orders                                           | ✅ Verified | **live: consultation 500 + 1 order 200 = INR 700.00, 2 lines**; integration reads the encounter's orders                                                        |
| **Mock payment gateway** behind the adapter                                    | ✅ Verified | existing `PaymentGateway` seam; **live: paid, paymentRef `mock-pay-INV-000001`**; real gateway = Stage 8                                                        |
| Invoice UI                                                                     | ✅ Verified | BillingPanel in the encounter workspace: generate → line items + total → take payment → share; a11y 0 violations                                                |
| **Mock ABDM share-on-consent** (care context + consent artifact + FHIR bundle) | ✅ Verified | `ConsentProvider.validateConsent` + new `AbdmGateway.linkCareContext`; **live: careContextRef + consent artifact**; encounter `$everything` bundle from Stage 5 |

## Exit criteria (Master Plan §16) — demonstrated live on compose

| Criterion                                | Status | Evidence                                                                                                                                    |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Generate an invoice for an encounter     | ✅     | `POST /v1/encounters/{id}/invoice` → **201 INV-000001, issued, INR 700.00**                                                                 |
| View / settle via mock payment           | ✅     | `POST /v1/invoices/{id}/pay` (Idempotency-Key) → **paid**; replay idempotent (same ref); **double-pay → 409**                               |
| **The full OPD golden path is demoable** | ✅     | **live end-to-end:** register → schedule → check-in → document (cc/vitals/dx/note) → order → result → sign → invoice → pay → **mock share** |
| audited                                  | ✅     | audit chain **INTACT, 0 breaks / 87 rows**; invoice.issue / invoice.pay / encounter.share all audited                                       |
| isolation suite green                    | ✅     | **19/19** incl. billing.invoice/invoice_line cross-tenant read + WITH CHECK forgery                                                         |

## Additional proofs (beyond the criteria)

- **Money is exact** (integer-paise math → `numeric` strings; never float): total 500.00 + 200.00 + 200.00 = **900.00** (integration).
- **One invoice per encounter:** a second generate → **409** (unique); **live-confirmed**.
- **No double-pay:** payment marking is status-guarded (`WHERE status='issued'`) + versioned — a paid invoice cannot be re-paid (integration + live).
- **Idempotent payment (APDR-0006):** replay with the same key returns the original settlement.
- **BDR-0004 honored:** external payment/consent/ABDM calls happen **outside** the unit of work.
- **RBAC (D-6.5):** reception (cashier) invoices + settles; all clinical roles read; **share is doctor/reception** (authz matrix). **Live: doctor/admin cannot take payment (billing:manage denied).**
- **Cross-tenant integrity (DDR-0008):** invoicing another tenant's encounter → FK violation (integration).
- **FHIR Invoice (dark):** 404 while `fhir.read` false; on → valid `Invoice` (`balanced`, totalGross 700 INR, 2 line items); reverted.
- **No PHI in events:** outbox payloads carry ids/version only — `invoice.issued.v1`, `invoice.paid.v1`, `encounter.shared.v1`.

## Gate sweep (all green)

| Gate                                                 | Command                                 | Result                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| format · build · typecheck                           | `pnpm format:check · build · typecheck` | clean · 13/13 · 22/22                                                                                                     |
| lint (BDR-0013 boundaries)                           | `pnpm lint`                             | clean                                                                                                                     |
| unit (incl. contract + M-1 gate + Constitution gate) | `pnpm test`                             | **84** (contracts 30, api 19, authz 13, crypto 11, events 4, config 3, web 4)                                             |
| crypto coverage                                      | `pnpm --filter @aiims/crypto test`      | 98.5% ≥ 90%                                                                                                               |
| integration (real Postgres)                          | `test:integration`                      | **35** (Stage 1–5 ×30, **Stage 6 ×5**: money math, one-per-encounter 409, no-double-pay, cross-tenant FK, charge capture) |
| **isolation gate**                                   | `test:isolation`                        | **19/19** (+ billing probes)                                                                                              |
| RLS policy-diff                                      | `check:rls`                             | all present/enabled/FORCED (incl. `billing` schema + 3 tables)                                                            |

**Test totals:** 84 unit + 35 integration + 19 isolation = **138**. OpenAPI paths: **44** (all Stage 6 routes covered by the M-1 gate).

## Milestone B — OPD golden path (demo gate, §22)

The complete investor/hospital-demoable vertical is **green end-to-end on compose**:

> **register (front-desk)** → **schedule + check-in (front-desk)** → **consult & document: chief complaint, vitals, diagnosis, note (doctor)** → **order + result (doctor)** → **sign (doctor)** → **invoice (front-desk)** → **pay, mock (front-desk)** → **mock ABDM share-on-consent** → FHIR bundle regenerable.

Every step is tenant-scoped, RBAC-enforced by role, audited (chain intact), and reversible only through the proper state transitions.

## Definition of Done (§20)

| DoD item                                   | Status                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — decisions D-6.1…D-6.7 are approved realizations; no frozen decision changed |
| Unit + integration + contract tests green  | ✅ 84 + 35; contract tests validate money DTOs + FHIR Invoice mapper             |
| **Isolation suite green**                  | ✅ 19/19                                                                         |
| No PHI in logs/telemetry; audit emitted    | ✅ reference-only events; billing reads/writes audited; chain intact             |
| Deployed to staging                        | ⏳ AWS-gated (carried from Stage 0–5, founder-deferred)                          |
| Exit criteria demoed                       | ✅ this report + **full OPD golden-path E2E** on compose                         |
| Docs updated                               | ✅ this report                                                                   |

## Decisions realized (D-6.1…D-6.7)

- **D-6.1** `billing` schema (invoice + invoice_line) · **D-6.2** charge capture: consultation fee + one line per order
- **D-6.3** mock payment via the `PaymentGateway` adapter; Idempotency-Key; status-guarded no-double-pay
- **D-6.4** mock ABDM share-on-consent (`ConsentProvider` + `AbdmGateway.linkCareContext`) — closes the golden path
- **D-6.5** RBAC: reception invoices/settles; all clinical read; share is doctor/reception · **D-6.6** per-tenant invoice numbering (INV-%06d)
- **D-6.7** dark FHIR Invoice by flag

## Deviations & notes

- **Payment, consent, and ABDM share are mocks** (deterministic, no external calls) — the _seams_ are real; the
  real payment gateway, DPDP/ABDM consent manager, and HIP/HIU care-context flow are **Stage 8** behind the same
  adapters. No AWS or external credentials are exercised.
- **Money** is stored `numeric(12,2)` and computed in integer paise; the API exchanges 2-decimal strings.
- **FHIR Invoice** is a light, schema-valid projection (dark by flag).

## Commits (Stage 6)

| Commit    | Scope                                                                  |
| --------- | ---------------------------------------------------------------------- |
| `49e3e4b` | contracts, events, FHIR Invoice mapper                                 |
| `26473f3` | db — migrations 0013/0014 + billing queries                            |
| `7a4b4d0` | api module — invoice/pay/share, AbdmGateway.linkCareContext, dark FHIR |
| `f74fefa` | web — billing panel in the encounter workspace                         |
| `be4b07d` | tests — authz, integration, isolation probes                           |

---

## Remaining stages (7–9): status & what they need

The demoable product (Milestone B) is complete. The remaining stages are **gated on external decisions and
credentials that have not been provided** — I have not fabricated them:

- **Stage 7 — AI Platform:** needs an **isolated Python `ai` plane**, **pgvector RAG**, a **real LLM provider**
  (the LLM-residency decision, AIDR-0004, is an **open founder item**), a **redaction pipeline**, and
  **release-blocking safety/PHI/injection evals**. The `AiGateway` seam already exists (mock, Constitution-guarded).
  _Buildable once an LLM provider + residency decision are given._
- **Stage 8 — External Integrations:** swap mocks for **real ABDM sandbox (M1/M2/M3 + consent), real payment,
  real notification** — each requires **external accounts + NHA sandbox certification**. _Blocked on credentials._
- **Stage 9 — Production Hardening:** **MFA/SSO, WORM audit, cross-region DR + game-day, external pen-test,
  per-tenant CMK, SIEM, legal retention durations, AWS go-live** — the **AWS account is founder-deferred since
  Stage 0**, and pen-test/legal are external. _Blocked on AWS + legal/security engagements._

**Recommendation:** to proceed, provide (a) an LLM provider + residency decision for Stage 7, (b) ABDM sandbox +
payment/notification credentials for Stage 8, and (c) an AWS account + pen-test/legal sign-offs for Stage 9.

---

**Stage 6 is complete and verified. Milestone B (demoable OPD golden path) is green.**
