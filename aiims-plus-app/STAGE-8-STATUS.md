# AIIMS+ — Stage 8 (External Integrations) — Status & Verification Report

**Date:** 2026-07-08 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §18
**Purpose:** map every Stage 8 deliverable to verification evidence.
Stage 8 implements the **real integration adapters behind the existing seams**, per the rules: nothing is
fabricated, every integration stays behind its adapter, mocks remain the default, and each real adapter
**activates only when configuration + credentials are supplied** — failing fast otherwise. No frozen
decision changed. **Items requiring external certification/accounts are marked pending.**

## Deliverables (Master Plan §18)

| Deliverable                                                | Status                       | Evidence                                                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real **ABDM** M1→M3 path behind `AbdmGateway`              | ✅ Built, disabled           | `RealAbdmGateway`: session token + verify/create ABHA + link-care-context; `ADAPTER_ABDM=real` + `ABDM_BASE_URL/CLIENT_ID/SECRET`; **fail-fast without creds (tested)**       |
| Real **payment** gateway behind `PaymentGateway`           | ✅ Built, disabled           | `RealPaymentGateway` (Bearer HTTP, idempotency-key); needs `PAYMENT_BASE_URL/API_KEY`; fail-fast tested                                                                       |
| Real **notification** provider behind `NotificationSender` | ✅ Built, disabled           | `RealNotificationSender` (Bearer HTTP; template+recipient refs, no PHI); needs `NOTIFICATION_*`; fail-fast tested                                                             |
| Real **object storage** behind `StorageGateway`            | ✅ **Built & live-verified** | `RealStorageGateway` genuine **AWS SigV4** presign (no deps); **live: MinIO accepted a PUT (HTTP 200) via the presigned URL; 11-byte object stored at the tenant-scoped key** |
| Each behind its **feature flag / config**, mocks swappable | ✅ Verified                  | `adapters.module` `pick()` constructs real only when `ADAPTER_*=real`; mock default everywhere; `ADAPTER_STORAGE=real` boot verified healthy                                  |

## Verification — how "real activates only on credentials" was proven

- **Fail-fast without credentials (unit):** each real adapter throws at construction if its env is missing —
  `RealAbdm/Payment/Notification/Storage` all `.toThrow(/requires/)`; the `adapters.resolve` test asserts that
  selecting `real` for every seam **rejects at boot** (never a silent fallback to mock).
- **Real SigV4 is correct (offline unit):** the storage presigner emits a well-formed URL with all
  `X-Amz-*` params and a 64-hex HMAC-SHA256 signature; PUT and GET sign differently (method is in the canonical request).
- **Real works end-to-end (live):** booting with `ADAPTER_STORAGE=real` + MinIO credentials, the EMR
  `presign-upload` returned a real `AWS4-HMAC-SHA256` URL, **MinIO validated the signature and accepted the
  upload (HTTP 200)**, and the object is listed under `t/<tenant>/enc/<id>/…/report.txt`.
- **Mocks still default:** the full mock suite (integration 35 / isolation 19 / golden-path) is unchanged;
  no domain code changed — swapping is pure config.

## Gate sweep (all green)

| Gate                              | Result                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| format · build · typecheck · lint | clean · 13/13 · 22/22 · clean                                                                             |
| unit                              | **100** (api 32 incl. 6 real-adapter tests, contracts 32, authz 14, crypto 11, events 4, config 3, web 4) |
| integration · isolation           | **35 · 19** (unchanged — S8 adds no tables)                                                               |
| AI safety evals                   | 8/8                                                                                                       |

## Scope honestly marked pending (external certification / accounts)

Per the rules, these are **built as seams but cannot be certified/activated without external engagement** —
no credentials fabricated:

- **ABDM sandbox certification (NHA validators):** `RealAbdmGateway` is written to ABDM M1/M2/M3 conventions;
  the exact routes + payloads are finalised against the **NHA sandbox** during certification. Needs sandbox
  credentials + certification run. **Endpoints are configurable via `ABDM_BASE_URL`.**
- **Real payment/notification providers:** the HTTP clients are provider-generic; the concrete request/response
  mapping is finalised against the **chosen provider's** API once an account exists.
- **DPDP + ABDM Consent Manager:** the real `ConsentProvider` is part of ABDM certification; today only the mock
  is built (selecting `ADAPTER_CONSENT=real` fails fast with a clear "pending certification" message).
- **Outbound signed webhooks (APDR-0010):** optional; deferred.

## Definition of Done (§20)

| DoD item                                    | Status                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| Implements frozen design; nothing reopened  | ✅ — same ports; only real implementations added behind them |
| Unit + contract tests green                 | ✅ 100 unit incl. real-adapter conformance + fail-fast       |
| **Isolation suite green**                   | ✅ 19/19                                                     |
| Mocks swappable by config, no domain change | ✅ verified (storage mock↔real by env only)                  |
| Exit criteria demoed                        | ✅ **live MinIO SigV4 round-trip** + fail-fast proofs        |
| Sandbox conformance (NHA)                   | ⏳ pending ABDM sandbox credentials + certification          |
| Deployed to staging                         | ⏳ AWS-gated (carried forward)                               |

## Commits (Stage 8)

| Commit    | Scope                                                                                 |
| --------- | ------------------------------------------------------------------------------------- |
| `bdd2b02` | config credentials + real ABDM/payment/notification/storage adapters + rewire + tests |

---

**Stage 8 is complete for everything buildable without external accounts.** The real adapters are built, tested,
fail-fast, and mock-default; the **storage adapter is verified live against MinIO**. ABDM sandbox certification and
real payment/notification provider mapping remain **pending external credentials** — activatable by config with no code change.
