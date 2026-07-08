# AIIMS+ — Production Readiness Checklist

**Date:** 2026-07-08 · **Owner:** Founders / Eng · **Scope:** what must be true before AIIMS+ handles
real patient data in production.

This checklist is deliberately honest. Everything that can be **finished in code without an AWS account
or an external certification/authority is done and verified** (✅). Everything that **requires a cloud
account, a third-party authority, legal counsel, or a live operational drill is marked PENDING** (⏳) with
the reason — these are not engineering gaps, they are activities that need an external party or
environment. No item is claimed complete unless it is verifiable in this repository.

Legend: ✅ done & verified · 🟡 built, dormant until configured · ⏳ pending (needs account/authority/legal)

---

## 1. Tenant isolation & data protection

| Item                                                        | State | Evidence / note                                                                                                         |
| ----------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| Postgres RLS **FORCE**, fail-closed, on every tenant table  | ✅    | `check:rls` policy-diff gate; isolation suite runs as `aiims_app`                                                       |
| Cross-tenant isolation test as the app role                 | ✅    | `@aiims/testing` isolation-gate (BLOCKING in CI)                                                                        |
| PHI encrypted at rest (per-record data keys, blind indexes) | ✅    | `@aiims/crypto` AES-GCM + `enc_key_ref`; DDR-0006                                                                       |
| Transactional outbox (no dual-write)                        | ✅    | `outbox` + relay; DDR-0007                                                                                              |
| Hash-chained, tamper-evident audit log                      | ✅    | `verify:audit` re-walk gate wired into isolation-gate (ODR-0011)                                                        |
| Retention + crypto-shred engine                             | 🟡    | built & E2E-verified; **durations loaded from `RETENTION_POLICY_JSON` — inert until a policy is configured** (ADR-0009) |
| Per-tenant **Customer-Managed Keys (CMK)** in KMS           | ⏳    | KeyProvider seam exists (`aws-kms` id reserved); needs an **AWS/KMS account** to provision the CMK hierarchy            |
| Exact retention **durations** by record class               | ⏳    | parameters only; **needs legal/compliance counsel** (ADR-0009 deferred list)                                            |

## 2. AuthN / AuthZ

| Item                                                                  | State | Evidence / note                                                                                                  |
| --------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| OIDC via Keycloak; JWT verified against JWKS; tenant claim → RLS      | ✅    | `auth.guard.ts`; SDR-0003                                                                                        |
| RBAC permission model (least privilege)                               | ✅    | `@aiims/authz` (14 tests)                                                                                        |
| **MFA (TOTP)** policy + forced enrolment for new users                | ✅    | realm `otpPolicy` + `CONFIGURE_TOTP` defaultAction; verified on Keycloak 26.4                                    |
| Brute-force protection + strong password policy                       | ✅    | realm `bruteForceProtected` + `passwordPolicy`; verified via admin API                                           |
| Auth-Code + **PKCE** for the web client; BFF holds tokens server-side | ✅    | `aiims-web` client; SDR-0001                                                                                     |
| Production IdP: real users, remove synthetic realm/dev CLI client     | ⏳    | dev realm ships synthetic users + a direct-grant CLI client (local only); **prod provisions its own IdP tenant** |

## 3. Transport & application hardening

| Item                                                            | State | Evidence / note                                                                  |
| --------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------- |
| Security response headers (HSTS, CSP, XFO, nosniff, no-store …) | ✅    | api middleware + web `next.config`; live-verified on `/health`                   |
| `X-Powered-By` / framework fingerprint removed                  | ✅    | api middleware + `poweredByHeader:false`                                         |
| DTO-only boundary (Zod), OpenAPI coverage gate                  | ✅    | M-1 coverage test (routes ⊆ documented paths)                                    |
| TLS termination + HSTS preload at the edge                      | ⏳    | HSTS is emitted; **needs the production load-balancer/cert** (AWS ACM / ingress) |
| WAF / rate-limiting at the edge                                 | ⏳    | **needs the cloud edge** (e.g. AWS WAF / API GW throttling)                      |

## 4. External integrations (all behind adapters — ADR-0010)

| Item                                                       | State | Evidence / note                                                                                        |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| ABDM / consent / payment / notification / storage adapters | 🟡    | real impls built; **activate only with `ADAPTER_*=real` + credentials**; fail-fast otherwise (Stage 8) |
| Object storage SigV4 presign                               | ✅    | live-verified against MinIO (HTTP 200)                                                                 |
| **ABDM M2/M3 sandbox certification**                       | ⏳    | needs **NHA/ABDM sandbox credentials + certification**                                                 |
| Payment gateway go-live (PCI scope)                        | ⏳    | needs **PSP merchant account**; card data stays out of scope by design                                 |
| Consent Manager production wiring                          | ⏳    | throws "pending certification" on `real`; needs **CM onboarding**                                      |

## 5. AI plane (Constitution-bound)

| Item                                                   | State | Evidence / note                                                  |
| ------------------------------------------------------ | ----- | ---------------------------------------------------------------- |
| Operational-only AI; no diagnosis/treatment/write path | ✅    | `ai-constitution.test` static scan; safety gates 422             |
| PHI redaction before model calls; AI audit; HITL label | ✅    | `apps/ai` redaction + `AI-generated — verify` label              |
| Release-blocking safety evals                          | ✅    | 8/8 evals; blocking `ai-evals` CI job                            |
| Provider abstraction (mock default; http provider)     | 🟡    | `provider_from_env()` → mock unless `AI_PROVIDER=http` + key     |
| Production model provider contract + red-team          | ⏳    | needs a **chosen provider account** + adversarial eval expansion |

## 6. Operations, DR & compliance (need environment / authority)

| Item                                                                                          | State | Evidence / note                                     |
| --------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------- |
| CI gates: build/typecheck/lint, unit, isolation, integration, RLS diff, audit-chain, AI evals | ✅    | `.github/workflows/ci.yml`                          |
| Observability seam (OTel tracing, structured logs, correlation id)                            | ✅    | `platform/tracing`, `logger`, `request-context`     |
| Centralized **SIEM / log aggregation + alerting**                                             | ⏳    | needs a **cloud logging/SIEM account**              |
| **Backups + PITR + restore drill**                                                            | ⏳    | needs the **managed Postgres/RDS environment**      |
| **DR runbook + failover drill (RTO/RPO)**                                                     | ⏳    | needs staging/prod infra to rehearse                |
| **Third-party penetration test**                                                              | ⏳    | needs an **external security firm**                 |
| **DPDP: DPIA, Data-Fiduciary classification, breach process**                                 | ⏳    | needs **legal/DPO**; ADR-0009 deferred list         |
| Infra-as-code + secrets manager provisioning                                                  | ⏳    | needs the **AWS account**; no secrets are committed |

---

## Summary

- **Engineering completable without external accounts/authorities: complete through Stage 9.** Isolation,
  encryption, audit tamper-evidence, retention/crypto-shred, MFA, brute-force + password policy, and
  transport hardening are implemented **and verified** in this repo.
- **Dormant-by-design (🟡):** real integrations, the retention engine, and the AI http provider are
  production-ready but **activate only when their configuration/credentials are supplied** — never
  fabricated, always fail-fast.
- **Genuinely pending (⏳):** every remaining item requires an **AWS account, an external certification
  authority (ABDM/PSP/CM), legal counsel, or a live operational drill** — none are code gaps.

> Do not process real patient data until every ⏳ item in §1–§6 has an owner and a sign-off date.
