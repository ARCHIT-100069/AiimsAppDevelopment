# AIIMS+ — Stage 1 (Core Platform) — Status & Verification Report

**Date:** 2026-07-05 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §11
**Purpose:** map every Stage 1 deliverable, exit criterion, and DoD item to verification evidence.
All Stage 0 guarantees (tenant isolation, audited writes, outbox, RLS, RBAC, contract-first) are
preserved and now exercised by real platform modules.

## Deliverables (Master Plan §11)

| Deliverable                                                               | Status                  | Evidence                                                                                                                               |
| ------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `platform` schema: organization, facility, department                     | ✅ Verified             | Migration 0002; tenant-scoped composite FKs (DDR-0008); FORCE RLS + fail-closed policies (0003); isolation gate green                  |
| Tenant registry operations                                                | ✅ Verified             | `/v1/tenants` (platform operators): 201 create → 200 idempotent replay → 409 foreign-slug conflict, live E2E                           |
| `app_user` (Keycloak-sub mapping), role, user_role (+ department scoping) | ✅ Verified             | user creation + idempotent role assignment E2E; `user_role.department_id` expand migration                                             |
| RBAC PDP in `packages/authz` enforced by guards (SDR-0002)                | ✅ Verified             | 8 matrix unit tests incl. separation of duties; live 403s (frontdesk manage-denial, platform-admin data-denial)                        |
| Reference code systems seed (ICD-10/SNOMED/LOINC, DDR-0012)               | ✅ Verified             | Minimal representative set, release-marked `dev-minimal` (clarification #2); read-only to `aiims_app` proven in the gate; queried live |
| Feature flags                                                             | ✅ Carried from Stage 0 | unchanged; per-tenant override query                                                                                                   |
| Observability wiring (OTel, IDR-0013)                                     | ✅ Implemented          | http/express/pg tracing behind `OTEL_EXPORTER_OTLP_ENDPOINT`; `/readyz` DB-checked probe; structured no-PHI logs unchanged             |

## Exit criteria (Master Plan §11) — demonstrated live on compose

| Exit criterion                                                           | Status | Evidence                                                                                                                                                                             |
| ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin creates tenant → org → facility → departments and users with roles | ✅     | platform.admin created tenant C (fixed id + bootstrap admin) → admin.c created org → facility → OPD-GEN + OPD-CARDIO → assigned doctor role                                          |
| RBAC denies/permits correctly                                            | ✅     | admin.c manages ✓; frontdesk.a POST /v1/organizations → 403; platform.admin GET /v1/organizations → 403 (registry-only); denials logged as security signals                          |
| Reference codes queryable                                                | ✅     | `/v1/reference/codes?system=loinc` returns seeded codes                                                                                                                              |
| Every action audited                                                     | ✅     | tenant C audit chain: 8 rows (tenant.create, user.create, organization/facility/2×department.create, 2×user.assign_role) — **per-tenant hash chain INTACT**; outbox 10/10 dispatched |
| Isolation suite green                                                    | ✅     | **12/12** retargeted to platform tables (incl. RLS-drop guardrail); tenant B sees 0 of tenant C's organizations through the API                                                      |

## Definition of Done (§20) — Stage-1 scope

| DoD item                                   | Status                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — one documented in-stage decision: platform operators via Keycloak realm role `platform_admin` (the docs were silent on tenant-registry authz) |
| Unit + integration + contract tests green  | ✅ 25 unit (authz matrix, contracts, config, events, adapters) + 5 integration (FK graft rejection, duplicate-safety, idempotent replays)          |
| **Isolation suite green**                  | ✅ 12/12                                                                                                                                           |
| CI gates                                   | ✅ unchanged pipeline covers the new suites (`test:integration` added)                                                                             |
| No PHI in logs/telemetry                   | ✅ events carry references/codes only; OTel spans exclude statement values                                                                         |
| Deployed to staging                        | ⏳ still gated on the AWS account (carried from Stage 0, founder-deferred)                                                                         |
| Exit criteria demoed                       | ✅ this report + live E2E during the build                                                                                                         |
| Docs updated                               | ✅ READMEs, this report                                                                                                                            |

## Founder clarifications — how they were honored

1. **/v1 + DTOs only:** all endpoints under `/v1`; controllers map rows → contract DTOs; DB entities never serialize to the wire.
2. **Minimal replaceable reference seed:** ~28 real codes across ICD-10/LOINC/SNOMED, upserted on natural keys with release marker `dev-minimal` — a production import replaces it with no schema change.
3. **Duplicate-safe/idempotent creation:** DB-anchored natural-key uniques (409 on conflict); idempotent replays for tenant creation (id+slug) and role assignment (no-op 200). Note: each API _action_ is still audited — replays audit the action, never duplicate the data.

## Deviations & engineering notes

- **Note proof module retired** (migration 0004 drops `platform.note`; manifest updated) — its audited-write guarantee is now carried by the platform modules.
- **`roleCodesForUsers` array bug** caught live in E2E (drizzle `sql` template mangled the array param) — fixed with `inArray`; regression covered by the users-list E2E path.
- **Keycloak provisioning stays manual** in Stage 1: creating an app user maps an existing Keycloak subject; Admin-API automation is Production integration work (ADR-0010).

## Stage 2 readiness

The platform prerequisites for Stage 2 (Patient Module) are in place: org/department structure,
users/roles, reference codes, audited-write pattern, adapters (mock ABDM ready for the ABHA field).
**Stage 2 has not been started.**
