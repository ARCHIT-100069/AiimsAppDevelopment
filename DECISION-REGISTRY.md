# AIIMS+ — Decision Registry (Master Index)

**Version:** 1.0 · **Owner:** Engineering Leadership (CTO) · **Status:** Frozen (living index)
**Dependencies:** `/GOVERNANCE.md` · **Last Updated:** 2026-07-04
**Review Trigger:** any document/record added, version-bumped, frozen, or superseded.

The single source of truth for the AIIMS+ engineering knowledge base. Every canonical document and every
decision record is listed here with owner, status, version, supersession, dependencies, freeze state, and
review trigger. If it is not in this registry, it is not canonical.

---

## 1. Canonical documents

| Document | Path | Owner | Status | Ver | Depends on | Frozen | Last review | Next review trigger |
|---|---|---|---|---|---|---|---|---|
| Governance | `/GOVERNANCE.md` | CTO | Frozen | 1.0 | — | ✅ | 2026-07-04 | New phase / rule failure |
| Decision Registry | `/DECISION-REGISTRY.md` | CTO | Frozen (living) | 1.0 | Governance | ➖ | 2026-07-04 | Any record change |
| README | `/README.md` | CTO | Accepted | 1.0 | Governance | ➖ | 2026-07-04 | Structure change |
| Roadmap | `/ROADMAP.md` | Eng Manager | Accepted | 1.0 | Blueprint, DB Arch | ➖ | 2026-07-04 | Stage completion / rescope |
| Implementation Master Plan | `/IMPLEMENTATION-MASTER-PLAN.md` | CTO / Eng Lead | **Frozen** (on approval) | 1.0 | ALL frozen phases + Roadmap | ✅ | 2026-07-04 | §6 flaw process / stage rescope |
| Open Issues & Assumptions | `/Open-Issues-and-Assumptions.md` | Eng Leadership | Accepted (living) | 1.1 | — | ➖ | 2026-07-04 | Item resolved / added |
| Architecture Blueprint | `/architecture/ARCHITECTURE-BLUEPRINT.md` | CTO / Chief Architect | **Frozen-core** | 1.1 | ADRs 0001–0011 | ✅ | 2026-07-04 | §6 flaw process |
| Database Architecture | `/database/DATABASE-ARCHITECTURE.md` | Database Architect | **Frozen** | 1.0 | Blueprint, ADR 0002/0003/0009/0011 | ✅ | 2026-07-04 | §6 flaw process |
| Security Blueprint | `/security/SECURITY-BLUEPRINT.md` | Security Architect | **Frozen** | 1.0 | Blueprint, DB Arch, ADR 0002/0005/0007/0008/0009, DDR 0002/0006/0007/0011 | ✅ | 2026-07-04 | §6 flaw process |
| Backend Architecture | `/backend/BACKEND-ARCHITECTURE.md` | Principal Engineer | **Frozen** | 1.0 | Blueprint, DB Arch, Security, ADR/DDR/SDR | ✅ | 2026-07-04 | §6 flaw process |
| API Architecture | `/api/API-ARCHITECTURE.md` | API/Backend Lead | **Frozen** | 1.0 | Blueprint §13, Backend, Security, DB, ADR/DDR/SDR/BDR | ✅ | 2026-07-04 | §6 flaw process |
| Frontend Architecture | `/frontend/FRONTEND-ARCHITECTURE.md` | Frontend Lead | **Frozen** | 1.0 | Blueprint §8, API, Security, Backend, DB | ✅ | 2026-07-04 | §6 flaw process |
| AI Architecture | `/ai/AI-ARCHITECTURE.md` | AI Systems Architect | **Frozen** | 1.0 | Constitution, Blueprint §10/§28, Security, Backend, DB, API | ✅ | 2026-07-04 | §6 flaw process |
| Infrastructure & DevOps | `/infrastructure/INFRASTRUCTURE-ARCHITECTURE.md` | Cloud & Infra Architect | **Frozen** | 1.0 | ADR 0001/0007, Security, DB, Backend, AI | ✅ | 2026-07-04 | §6 flaw process |
| Testing & Quality | `/testing/TESTING-ARCHITECTURE.md` | QA / Engineering Lead | **Frozen** | 1.0 | All frozen phases | ✅ | 2026-07-04 | §6 flaw process |
| Operations & SRE | `/operations/OPERATIONS-ARCHITECTURE.md` | SRE / Operations Lead | **Frozen** (on approval) | 1.0 | All frozen phases | ✅ | 2026-07-04 | §6 flaw process |

Legend: ✅ frozen · ➖ living/amendable.

---

## 2. Architecture Decision Records (ADR)

Owner: CTO / Chief Architect · Location: `/adr/` · Status: **Adopted / Frozen** (ADR 0009 deferred).

| ADR | Title | Status | Ver | Confidence | Reversibility | Supersedes | Depends on |
|---|---|---|---|---|---|---|---|
| 0001 | Modular monolith on ECS Fargate | Frozen | 1.0 | High | Medium | — | Blueprint |
| 0002 | Multi-tenancy: Postgres RLS, promotable | Frozen | 1.0 | High | Very low | — | 0001 |
| 0003 | Clinical model: relational core + FHIR facade | Frozen | 1.0 | High | Very low | — | 0002 |
| 0004 | Unified Consent Service, progressive integration | Frozen | 1.1 | High | Low | — | 0006, 0010 |
| 0005 | Audit: append-only, tamper-evident | Frozen | 1.0 | High | Low | — | 0001 |
| 0006 | ABDM adapter, M1→M4 sequenced | Frozen | 1.0 | High | Medium | — | 0003, 0004 |
| 0007 | Data residency ap-south-1 / DR ap-south-2 | Frozen | 1.0 | High/Med | Medium | — | 0001 |
| 0008 | Identity: Keycloak (buy, not build) | Frozen | 1.0 | Med-High | Medium | — | 0001 |
| 0009 | Retention & erasure | **Deferred (Legal)** | 1.1 | Medium | Very low | — | 0003 |
| 0010 | Build once, integrate progressively | Frozen (rule) | 1.0 | High | n/a | — | — |
| 0011 | ORM: Drizzle (+ guardrails) | Frozen | 1.0 | Med-High | Very low | — | 0002, 0003 |

Review trigger (all ADRs): §6 flaw process only.

---

## 3. Database Decision Records (DDR)

Owner: Database Architect · Location: `/ddr/` · Implements the ADRs; does not contradict them.

| DDR | Title | Status | Ver | Confidence | Implements | Notes |
|---|---|---|---|---|---|---|
| 0001 | UUIDv7 app-generated PKs | Frozen | 1.0 | High | ADR 0002/0011 | — |
| 0002 | RLS: FORCE, fail-closed, SET LOCAL | Frozen | 1.0 | High | ADR 0002 | Core PHI safeguard |
| 0003 | Least-privilege Postgres roles | Frozen | 1.0 | High | ADR 0002 | — |
| 0004 | Bounded-context Postgres schemas | Frozen | 1.0 | Med-High | Blueprint §7 | — |
| 0005 | FHIR-regenerable hybrid modeling | Frozen | 1.0 | High | ADR 0003 | — |
| 0006 | PHI encryption: identifiers-only + KMS | **Frozen (ratified by SDR-0004)** | 1.0 | High | ADR 0009 | Signed off in Phase 3 |
| 0007 | Outbox + hash-chained audit | Frozen | 1.0 | High | ADR 0005 | — |
| 0008 | Tenant-scoped referential integrity | Frozen | 1.0 | High | ADR 0002 | — |
| 0009 | Optimistic concurrency + slot exclusion | Frozen | 1.0 | High | Blueprint §26 | btree_gist |
| 0010 | Time-range partitioning | Frozen | 1.0 | High | ADR 0001 | audit/outbox now |
| 0011 | Migration governance (RLS as reviewed SQL) | Frozen | 1.0 | High | ADR 0011 | drizzle-kit RLS off |
| 0012 | Coded concepts & global reference data | Frozen | 1.0 | High | ADR 0003 | — |
| 0013 | Soft-delete, retention, versioning | **Accepted (durations deferred)** | 1.0 | Med-High | ADR 0009 | legal input |

---

## 4. Security Decision Records (SDR)

Owner: Security Architect · Location: `/security/` · Status: **Frozen (approved 2026-07-04)**.
Harden the frozen ADRs/DDRs; SDR-0004 ratifies DDR-0006.

| SDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Identity & token (Keycloak/OIDC/PKCE/BFF) | ADR 0008 | Accepted | High |
| 0002 | Authorization: RBAC-now, ABAC-ready, break-glass | Blueprint §11 | Accepted | High |
| 0003 | Tenant isolation defense-in-depth | DDR 0002/0003/0008 | Accepted | High |
| 0004 | PHI protection & field encryption (**ratifies DDR-0006**) | ADR 0009/DDR 0006 | Accepted | High |
| 0005 | Key management: KMS CMK hierarchy + envelope | DDR 0006 | Accepted | High |
| 0006 | Secrets management | Blueprint §20 | Accepted | High |
| 0007 | Audit integrity & tamper-evidence | DDR 0007 | Accepted | High |
| 0008 | Network & infrastructure security | ADR 0001/0007 | Accepted | High |
| 0009 | API security controls | Blueprint §13 | Accepted | High |
| 0010 | Logging/monitoring & PHI redaction | Blueprint §22 | Accepted | High |
| 0011 | AI security boundary controls | Blueprint §10/§28 | Accepted | High |
| 0012 | Supply chain & secure SDLC | Blueprint §23 | Accepted | High |
| 0013 | Incident response & breach notification | ADR 0009 | Accepted (timelines legal-deferred) | Med-High |

---

## 5. Backend Decision Records (BDR)

Owner: Principal Engineer · Location: `/backend/` · Status: **Frozen (approved 2026-07-04)**.
Realize the frozen ADRs/DDRs/SDRs in backend structure; contradict none.

| BDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Layered module architecture | ADR 0001 | Accepted | High |
| 0002 | Module boundaries & communication | Blueprint §7, DDR 0004 | Accepted | High |
| 0003 | Repository pattern & Drizzle confinement | DDR 0011, ADR 0011 | Accepted | High |
| 0004 | Transaction boundary = application service | DDR 0002/0007 | Accepted | High |
| 0005 | Event flow via outbox dispatcher | DDR 0007, ADR 0001 | Accepted | High |
| 0006 | CQRS-lite (projections, not event sourcing) | Blueprint §26 | Accepted | High |
| 0007 | Background jobs on BullMQ | Blueprint §15 | Accepted | High |
| 0008 | Integration ports & adapters (mock default) | ADR 0010/0004/0006, SDR 0011 | Accepted | High |
| 0009 | Layered validation strategy | SDR 0009, DDR 0008/0012 | Accepted | High |
| 0010 | Error taxonomy & response envelope | SDR 0009/0010 | Accepted | High |
| 0011 | Configuration & secrets management | SDR 0006, ADR 0010 | Accepted | High |
| 0012 | Cross-cutting middleware order & observability | SDR 0001/0002/0003/0007/0010 | Accepted | High |
| 0013 | Dependency-direction enforcement | ADR 0011 | Accepted | High |

---

## 6. API Decision Records (APDR)

Owner: API/Backend Lead · Location: `/api/` · Status: **Frozen (approved 2026-07-04)**.
Define the API surface over the frozen phases; contradict none.

| APDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | REST + JSON, resource-oriented; GraphQL deferred | Blueprint §13 | Accepted | High |
| 0002 | URI major versioning + additive change + deprecation | Blueprint §13 | Accepted | High |
| 0003 | Response envelope + Problem-Details error + validation | BDR 0009/0010, SDR 0009 | Accepted | High |
| 0004 | API auth flow (OIDC bearer + BFF + tenant + PEP/PDP) | SDR 0001/0002/0003 | Accepted | High |
| 0005 | Cursor pagination + allow-listed filter/sort | DB §12 | Accepted | High |
| 0006 | Idempotency-Key + optimistic concurrency | BDR 0004, DDR 0009 | Accepted | High |
| 0007 | File transfer via presigned S3 URLs | SDR 0004, Blueprint §16 | Accepted | High |
| 0008 | Long-running ops: async 202 + operation resource | BDR 0005/0007 | Accepted | High |
| 0009 | Realtime: SSE now, WebSockets deferred | Blueprint §17 | Accepted | Med-High |
| 0010 | Outbound webhooks (signed), Production | ADR 0010, SDR 0004 | Accepted | High |
| 0011 | Internal/external + public/private + gateway strategy | ADR 0001, Blueprint §17 | Accepted | High |
| 0012 | FHIR API boundary separation (`/fhir/R4`) | ADR 0003/0006 | Accepted | High |
| 0013 | Rate limiting & quotas | SDR 0009 | Accepted | High |
| 0014 | Contract-first OpenAPI 3.1 + API governance | Blueprint §13, BDR 0002 | Accepted | High |

---

## 7. Frontend Engineering Decision Records (FEDR)

Owner: Frontend Lead · Location: `/frontend/` · Status: **Frozen (approved 2026-07-04)**.
Web (Next.js) + native mobile (React Native + Expo) over the frozen phases; contradict none.

| FEDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Web stack: Next.js + React + TS + Tailwind/shadcn + BFF | Blueprint §8 | Accepted | High |
| 0002 | Mobile stack: React Native + Expo (native iOS/Android) | Blueprint "Future: Mobile" | Accepted | Med-High |
| 0003 | Cross-platform code sharing (shared packages + platform UI) | Backend `packages/*` | Accepted | High |
| 0004 | Design system, tokens, theming, a11y, i18n | Blueprint §8 | Accepted | High |
| 0005 | State: TanStack Query + Zustand | Blueprint §8 | Accepted | High |
| 0006 | API integration: typed client + flags + observability | APDR 0003/0014, SDR 0010 | Accepted | High |
| 0007 | Auth: web BFF cookie; mobile PKCE + secure storage | SDR 0001, ADR 0008, APDR 0004 | Accepted | High |
| 0008 | Authorization-aware UI (server-authoritative) | SDR 0002 | Accepted | High |
| 0009 | Navigation & routing (shared route+permission model) | API §7 | Accepted | High |
| 0010 | Offline-first & encrypted client caching (phased) | SDR 0004, APDR 0006 | Accepted (offline PHI: Security sign-off) | Med |
| 0011 | Forms & validation: RHF + shared Zod | APDR 0003, BDR 0009 | Accepted | High |
| 0012 | Realtime via SSE → cache invalidation | APDR 0009 | Accepted | High |
| 0013 | Frontend security & PHI-on-client policy | SDR 0001/0004/0009/0010 | Accepted | High |
| 0014 | Frontend testing strategy (hooks; detail in TDR) | Backend §18 | Accepted | High |

---

## 8. AI Decision Records (AIDR)

Owner: AI Systems Architect · Location: `/ai/` · Status: **Frozen (approved 2026-07-04)**.
Operational-only, Constitution-compliant; consumes the frozen phases; contradict none.

| AIDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Operational-only boundary + governance + flags (Constitution) | Ch.19, SDR 0011 | Accepted | High |
| 0002 | AI Gateway (single ingress/egress) | BDR 0008, SDR 0011 | Accepted | High |
| 0003 | Isolated Python AI plane (deploy/scale) | Blueprint §10, ADR 0001 | Accepted | High |
| 0004 | LLM provider strategy, selection & routing | ADR 0007/0010 | Accepted (provider deferred) | Med-High |
| 0005 | RAG + knowledge mgmt (tenant-scoped, grounded) | DDR 0002 | Accepted | High |
| 0006 | Vector DB: pgvector → dedicated | DDR 0002, Blueprint §17 | Accepted | High |
| 0007 | Prompt architecture (versioned, guardrail) | SDR 0011 | Accepted | High |
| 0008 | PHI protection & redaction before model calls | SDR 0004 | Accepted | High |
| 0009 | AI security + prompt-injection defense | SDR 0011 | Accepted | High |
| 0010 | Human-in-the-loop (Constitution) | Ch.19 | Accepted | High |
| 0011 | AI audit logging + observability | DDR 0007, SDR 0007/0010 | Accepted | High |
| 0012 | AI evaluation & safety gates | SDR 0011 | Accepted | High |
| 0013 | AI cost, caching, rate limiting | SDR 0004, APDR 0013 | Accepted | High |
| 0014 | AI fail-safe & availability (off critical path) | Blueprint §28 | Accepted | High |

---

## 9. Infrastructure Decision Records (IDR)

Owner: Cloud & Infrastructure Architect · Location: `/infrastructure/` · Status: **Frozen (approved 2026-07-04)**.
Deployment substrate for the frozen phases; contradict none; **resolves the RPO/RTO deferral**.

| IDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | AWS Organizations multi-account + SCP guardrails | SDR 0008, ADR 0007 | Accepted | High |
| 0002 | Multi-environment (dev/staging/prod) via Terraform | SDR 0012 | Accepted | High |
| 0003 | VPC, networking & security groups | SDR 0008 | Accepted | High |
| 0004 | ECS Fargate compute topology | ADR 0001 | Accepted | High |
| 0005 | Container & Docker standards + ECR | SDR 0012 | Accepted | High |
| 0006 | Aurora PostgreSQL (Multi-AZ, RDS Proxy, pgvector) | DDR 0002, ADR 0007 | Accepted | High |
| 0007 | ElastiCache Redis | Backend §15 | Accepted | High |
| 0008 | S3 + CloudFront CDN | SDR 0004, Blueprint §16 | Accepted | High |
| 0009 | ALB + Route 53 + ACM + WAF | SDR 0008 | Accepted | High |
| 0010 | KMS CMK hierarchy + Secrets Manager | SDR 0005/0006 | Accepted | High |
| 0011 | CI/CD (GitHub Actions, OIDC, gates) + web/mobile | SDR 0012 | Accepted | High |
| 0012 | Terraform/IaC + governance | SDR 0012 | Accepted | High |
| 0013 | Observability + monitoring/alerting | SDR 0010, Blueprint §22 | Accepted | High |
| 0014 | DR + backup/restore + **RPO/RTO targets** | ADR 0007 | Accepted (RTO sign-off) | Med-High |
| 0015 | Release (blue/green+canary) + autoscaling + cost | Blueprint §26, ADR 0010 | Accepted | High |
| 0016 | Local dev environment: Docker Compose parity substrate (PG/Redis/Keycloak/MinIO) | IDR 0002/0006/0007/0008, TDR 0013 | Accepted (2026-07-05, Stage 0) | High |

---

## 10. Testing Decision Records (TDR)

Owner: QA / Engineering Lead · Location: `/testing/` · Status: **Frozen (approved 2026-07-04)**.
Turn every prior phase's testing hooks into enforced gates; contradict none.

| TDR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Testing philosophy + pyramid | All phases | Accepted | High |
| 0002 | Unit testing (pure domain) | Backend §4/§18 | Accepted | High |
| 0003 | Integration + DB testing (real Postgres + RLS) | DDR 0002/0007/0009 | Accepted | High |
| 0004 | Contract testing (api-contracts + event-schemas) | APDR 0014, BDR 0005 | Accepted | High |
| 0005 | E2E + component (Playwright/Detox, OPD flow) | FEDR 0014 | Accepted | High |
| 0006 | RLS / multi-tenancy isolation gate (merge-blocking) | DDR 0002, DB §17 | Accepted | High |
| 0007 | AI eval, safety & prompt-regression (release gate) | AIDR 0012 | Accepted | High |
| 0008 | Security testing + pen-test + scanning | SDR 0012 | Accepted | High |
| 0009 | Performance, load/stress, chaos | IDR 0013/0015, AIDR 0014 | Accepted | Med-High |
| 0010 | Accessibility, mobile, cross-browser | FEDR 0004 | Accepted | High |
| 0011 | Infra, DR & backup/restore validation | IDR 0011/0014 | Accepted | Med-High |
| 0012 | CI/CD quality gates + coverage + release gates | IDR 0011 | Accepted | High |
| 0013 | Test data management (synthetic, no PHI) | SDR 0004/0010 | Accepted | High |
| 0014 | Test envs, observability, metrics, **production exit criteria** | IDR 0002 | Accepted | High |

---

## 11. Operations Decision Records (ODR)

Owner: SRE / Operations Lead · Location: `/operations/` · Status: **Accepted → freeze on approval**.
How the frozen platform is run in production; contradict none. **Completes the Engineering Operating System.**

| ODR | Title | Implements | Status | Confidence |
|---|---|---|---|---|
| 0001 | Operational philosophy + SRE model | All phases | Accepted | High |
| 0002 | SLOs, SLIs & error budgets | IDR 0013 | Accepted | High |
| 0003 | Incident response process | SDR 0013 | Accepted | High |
| 0004 | On-call strategy + escalation | SDR 0013 | Accepted | High |
| 0005 | Runbooks & playbooks | IDR 0011/0014 | Accepted | High |
| 0006 | Change & release management | IDR 0012/0015, TDR 0012 | Accepted | High |
| 0007 | Deployment procedures + rollback | IDR 0015, DDR 0011 | Accepted | High |
| 0008 | Dashboards + alert management | IDR 0013, SDR 0010 | Accepted | High |
| 0009 | Capacity, performance & cost monitoring | IDR 0015, DDR 0010, AIDR 0013 | Accepted | High |
| 0010 | Security operations (SecOps) | SDR 0008/0012 | Accepted | High |
| 0011 | Audit & compliance operations | DDR 0007, SDR 0007, ADR 0009 | Accepted | High |
| 0012 | DR ops, backup validation, game-days, BCP | IDR 0014, TDR 0011 | Accepted (RTO sign-off) | Med-High |
| 0013 | ORR + production readiness checklist | TDR 0014 | Accepted | High |
| 0014 | KPIs, continuous improvement & doc governance | GOVERNANCE | Accepted | High |

---

## 12. Future phases (reserved — no records yet)

| Phase | Folder | Prefix | Status | Depends on |
|---|---|---|---|---|
| Deployment | `/deployment/` | IDR/ODR | (covered by IDR-0011/0015 + ODR-0006/0007) | Infrastructure |
| Product | `/product/` | PDR | Not started | Blueprint, Roadmap |
| Research | `/research/` | RDR *(proposed)* | Not started | — |
| Legal | `/legal/` | LDR *(proposed)* | Not started | DB (ADR 0009) |

---

## 13. Open / deferred items (see `/Open-Issues-and-Assumptions.md`)

| ID | Item | Owner | Blocks | Trigger to resolve |
|---|---|---|---|---|
| C-1/C-2 | Legal retention durations + SDF classification (ADR 0009) | Founders + Counsel | Production retention engine | Legal engagement |
| DDR-0006 | ✅ Resolved — ratified by SDR-0004 (Phase 3) | Security Architect | — | Closed 2026-07-04 |
| — | FHIR India-profile field audit | DB + Interop | Column finalization | Before ABDM mapping |
| — | ✅ Resolved — RPO/RTO set in IDR-0014 (RPO ≤5min; RTO in-region ≤30min, cross-region ≤2h). Business RTO sign-off pending. | DevOps | — | Closed 2026-07-04 |
| — | AI-plane activation timing; search→OpenSearch trigger | Eng | — | Feature/volume threshold |
| FEDR-0010 | Offline PHI-on-device posture (mobile) — Security sign-off before enabling | Security + Frontend | Offline clinical workflows (mobile) | Security review of device storage |
| AIDR-0004 | LLM provider shortlist — DPDP residency + no-training confirmation | AI + Security + Legal | Enabling external models with (redacted) data | Provider/residency review |
| D-1/D-2/I-1 | Missing Context Pack, corrupted Vol IV, Constitution citation | Founders | — | Doc re-upload |

---

## 14. Phase completion ledger

| Phase | Status | Frozen on |
|---|---|---|
| Phase 1 — Architecture Review | ✅ Complete & Frozen | 2026-07-04 |
| Phase 2 — Database Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 3 — Security Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 4 — Backend Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 5 — API Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 6 — Frontend Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 7 — AI Architecture | ✅ Complete & Frozen | 2026-07-04 |
| Phase 8 — Infrastructure & DevOps | ✅ Complete & Frozen | 2026-07-04 |
| Phase 9 — Testing & Quality | ✅ Complete & Frozen | 2026-07-04 |
| Phase 10 — Operations & SRE | ✅ Complete (freeze on approval) | 2026-07-04 |

**🏁 All 10 architecture phases complete. The AIIMS+ Engineering Operating System is defined and frozen.
Next: implementation — Stage 0 of the MVP Roadmap.**
