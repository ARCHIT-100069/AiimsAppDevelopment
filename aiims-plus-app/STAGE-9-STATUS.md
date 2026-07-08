# AIIMS+ — Stage 9 (Hardening & Production Readiness) — Status & Verification Report

**Date:** 2026-07-08 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md`
**Purpose:** map every Stage 9 deliverable that does **not** require an AWS account or external
certification to verification evidence, and enumerate what remains pending (and why).

Stage 9 completes the **security & compliance engineering** that can be finished in code, under the
standing rules: no fabricated credentials, every integration stays behind its adapter, production-ready
pieces **activate only when configured**, and no frozen decision was changed. Remaining deployment items
that need a cloud account, a certification authority, legal counsel, or an operational drill are tracked
in [`PRODUCTION-READINESS-CHECKLIST.md`](./PRODUCTION-READINESS-CHECKLIST.md) and marked **pending**.

## Deliverables

| Deliverable                                                   | Status                                                             | Evidence                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit-integrity verifier** (WORM tamper-evidence, ODR-0011) | ✅ Built, tested, live-verified, CI-gated                          | `packages/db/src/verify-audit.ts` + shared `audit-hash.ts`; re-walks per-tenant hash chain (genesis + linkage + full recompute); `verify:audit` CLI wired into the isolation-gate after `check:rls` |
| **Retention + crypto-shred engine** (ADR-0009)                | ✅ Built, tested, live-verified · 🟡 inert until policy configured | `packages/db/src/retention.ts`; destroys `enc_key_ref` (+ ciphertext/blind-index) once `retention_until` expires; durations from `RETENTION_POLICY_JSON` only — **never hard-coded**                |
| **MFA (TOTP)** + brute-force + password policy                | ✅ Built, live-verified on Keycloak 26.4                           | `docker/keycloak/realm-aiims.json`: `otpPolicy` + `CONFIGURE_TOTP` defaultAction, `bruteForceProtected`, `passwordPolicy`                                                                           |
| **Security response headers** (API + web)                     | ✅ Built, tested, live-verified                                    | api `security-headers.ts` middleware; web `next.config.mjs` `headers()`; HSTS/CSP/XFO/nosniff/no-referrer/no-store/COOP/CORP/COEP; `X-Powered-By` stripped                                          |
| **Production Readiness Checklist** (pending items marked)     | ✅                                                                 | `PRODUCTION-READINESS-CHECKLIST.md` — ✅ done · 🟡 dormant · ⏳ needs account/authority/legal                                                                                                       |

## Verification evidence

### S9-1 — Audit-integrity verifier

- **Unit (5):** intact chain passes; empty chain trivial; **field-tamper detected**; deletion breaks
  linkage; forged genesis detected. Key ordering in `context` is irrelevant (shared `stableStringify`).
- **Live E2E (Postgres):** wrote rows through the **real writer** (`appendAuditRow`) with deliberately
  unsorted jsonb keys → chain verifies intact; a direct `UPDATE` to a row's `action` is caught as
  `row_hash does not match its data (tampered)`.
- **CI:** `pnpm --filter @aiims/db verify:audit` runs in the isolation-gate (exit 1 on any tamper).

### S9-2 — Retention + crypto-shred

- **Unit (7):** loader is **inert (null) with no policy**; parses a valid policy; rejects a rule missing
  `legalBasis`, a negative duration, or a payload without `rules`; schedule math; unknown class → no guess.
- **Live E2E (Postgres):** expired patient's `enc_key_ref` + `abha/phone/email` ciphertext + blind indexes
  destroyed, `version` bumped; **`patient.crypto_shredded` audit row appended**; **hash chain still
  verifies**; a second sweep shreds **0** (idempotent); a not-yet-expired patient is untouched.

### S9-3 — MFA + hardening (verified against a throwaway Keycloak 26.4)

- Realm **imports cleanly**; **direct-grant dev login still returns a token** (so the `aiims-cli`
  dev/token path is not broken). Admin API confirms `bruteForceProtected=true`, `passwordPolicy` set,
  `otpPolicyType=totp`, and `CONFIGURE_TOTP` `enabled + defaultAction=true`.
- Two real Keycloak findings were caught and fixed here (not guessed): an unknown top-level realm field is
  **rejected on import**, and Keycloak **validates imported credentials against the password policy** —
  so the synthetic dev passwords were made policy-compliant (README updated).
- **Headers:** 7 unit tests; **live API boot** shows every header on `/health` with **no `X-Powered-By`**.

## Gate sweep (all green)

| Gate                    | Result                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| typecheck · build       | **22/22** · **13/13**                                                                                                 |
| unit tests              | **119** (api 39, api-contracts 32, authz 14, db 12, crypto 11, web 4, event-schemas 4, config 3) across 22 test tasks |
| AI safety evals         | **8/8**                                                                                                               |
| isolation / integration | unchanged (S9 adds no tables); isolation-gate now **also runs `verify:audit`**                                        |
| new CI gate             | audit-chain re-walk (`verify:audit`) — BLOCKING                                                                       |

## Pending (require an AWS account / external authority / legal — see checklist)

- Per-tenant **CMK in KMS**, TLS/HSTS-preload at the edge, **WAF/rate-limiting**.
- **ABDM/PSP/Consent-Manager** production certification & credentials.
- **SIEM**, backups + **PITR restore drill**, **DR runbook + failover drill**.
- **Third-party penetration test**; **DPDP DPIA / Data-Fiduciary classification** and the exact
  **retention durations** (legal counsel).
- IaC + secrets-manager provisioning in the cloud account (no secrets committed).

**Bottom line:** all Stage 9 engineering not gated on an external account or certification is **complete
and verified**; the remainder is explicitly enumerated as pending with owners to be assigned.
