# AIIMS+ MVP Implementation Roadmap (India v1)

**Version:** 1.0 · **Owner:** Engineering Manager · **Status:** Accepted
**Dependencies:** architecture/ARCHITECTURE-BLUEPRINT.md, database/DATABASE-ARCHITECTURE.md
**Last Updated:** 2026-07-04 · **Review Trigger:** stage completion or MVP rescope

**Date:** 2026-07-03 · **Governing rule:** ADR 0010 — Build once, integrate progressively.
**Strategy:** Foundations → one complete golden path → breadth. Every item is tagged
[SF] Structural Foundation · [MVP] MVP Implementation · [PROD] Production · [FUT] Future.

The ordering rule: nothing in a later stage may force a rewrite of something in an earlier stage.
Deploy to `ap-south-1` from Stage 0 so the system is always shippable and demoable.

---

## Stage 0 — Walking Skeleton (all Structural Foundations)
*Goal: a deployed, authenticated, multi-tenant, audited app that does nothing clinical yet.*
No clinical feature starts until this is done, because all of it is retrofit-hostile.

1. **[SF] Monorepo + platform tooling** — TypeScript, NestJS, Prisma/Drizzle decision (ADR 0003),
   lint + module-boundary enforcement, CI, containerized deploy to Fargate. *DoD: hello-world service
   deploys to `ap-south-1` via pipeline.*
2. **[SF] Tenancy substrate (ADR 0002)** — Postgres, migrations, `tenant_id` convention, RLS policies,
   tenant-context middleware, and the **cross-tenant isolation test suite** as a permanent CI gate.
3. **[SF] Identity + authorization (ADR 0008)** — Keycloak dev realm, OIDC login, token→tenant context,
   in-app RBAC model (user/role/department/org/resource). *DoD: a user logs in and is scoped to a tenant.*
4. **[SF] Event bus + transactional outbox (ADR 0001)** — in-process bus, outbox table, dispatcher.
5. **[SF] Audit log (ADR 0005)** — append-only, hash-chained, fed by the outbox. Append-only in MVP;
   WORM storage is [PROD].
6. **[SF] Feature-flag framework** — so [PROD] integrations can be dark-launched behind flags.
7. **[SF] Adapter + mock-provider convention** — stable interfaces for ABDM, payments, notifications,
   and identity verification, each with a mock implementation selected by feature flag.
8. **[SF] API contract conventions** — OpenAPI, versioned endpoints, consistent error envelope.

**Exit criterion:** authenticated multi-tenant app in `ap-south-1`, every write audited, all external
seams present as mocks. This is the platform every feature is built on.

---

## Stage 1 — The Golden Path (MVP Implementation)
*Goal: one complete, demoable OPD (outpatient) journey end-to-end. This is the investor/hospital demo.*
Recommended hero flow = **OPD**, because it is the most universal hospital workflow and exercises every
foundation.

9.  **[MVP] Organization & facility setup** — hospital, departments, rooms (seeded or basic admin UI).
10. **[MVP] Staff & roles** — doctor, nurse, front-desk, admin within a tenant.
11. **[MVP] Patient registration** — demographics modeled as **FHIR Patient** (ADR 0003), with an ABHA
    field populated via the **mock ABDM M1** create/verify ([SF] interface + [MVP] mock; real M1 is [PROD]).
12. **[MVP] Scheduling / appointments** — front-desk books a patient with a doctor.
13. **[MVP] Encounter / OPD consultation** — doctor documents the visit: notes, vitals, diagnosis,
    problems (**FHIR Encounter / Observation / Condition**). *Constitution: no clinical AI, no diagnosis
    suggestions — documentation only, doctor decides.*
14. **[MVP] Orders & results** — lab/radiology order + result capture (**FHIR ServiceRequest /
    DiagnosticReport**), simplified.
15. **[MVP] Mock ABDM share-on-consent (ADR 0006 + 0004)** — create care context, issue a **mock consent
    artifact**, generate a real **FHIR R4 bundle** from the domain model, and "share." Demonstrates the
    entire ABDM value proposition with zero real certification. Real HIP/HIU M2/M3 is [PROD].

**Exit criterion:** a live demo of register → schedule → consult → document → order/result →
share-on-consent, multi-tenant and fully audited.

---

## Stage 2 — Breadth (MVP Implementation, to feel production-quality)
16. **[MVP] Billing / invoicing** — behind a **mock payment gateway** adapter; live gateway is [PROD].
17. **[MVP] Notifications** — appointment/result alerts behind a **mock SMS/email** adapter; real
    providers are [PROD].
18. **[MVP] Dashboards / basic reporting** — read models over the event stream (front-desk queue,
    doctor worklist, admin overview).
19. **[MVP] One more clinical module for depth** — Pharmacy **or** Lab, chosen by demo priority.

---

## Stage 3+ — Production Implementations (post-partnership, gated by go-live)
- **[PROD]** Real ABDM M1→M3 sandbox→production certification (ADR 0006).
- **[PROD]** DPDP + ABDM Consent Manager wiring (ADR 0004); DPDP notice/rights workflows.
- **[PROD]** WORM audit storage + integrity verifier (ADR 0005).
- **[PROD]** MFA, enterprise SSO, production identity verification (ADR 0008).
- **[PROD]** Cross-region DR to `ap-south-2`, RPO/RTO (ADR 0007).
- **[PROD]** Retention + crypto-shred engine + legal retention policy (ADR 0009 — needs legal input now).
- **[PROD]** Live payment gateway, production notification providers.
- **[FUT]** M4/NHCX claims, multi-country regions, US Core profiles, SIEM, advanced analytics.

---

## Open decisions before/at each stage
- **Stage 0:** Prisma vs Drizzle (RLS + FHIR mapping are the deciders) — ADR 0003.
- **Stage 1:** confirm OPD as the hero flow (vs IPD/admissions) — recommend OPD.
- **Anytime:** ADR 0009 retention policy needs founder + legal input; it can be gathered in parallel
  since only the schema *fields* (not the engine) are needed for MVP.
