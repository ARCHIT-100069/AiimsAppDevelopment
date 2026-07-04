# AIIMS+ — Testing & Quality Architecture (Phase 9)

**Version:** 1.0 · **Owner:** QA / Engineering Lead · **Status:** **Frozen (canonical, approved 2026-07-04)**
**Dependencies:** all frozen phases — Architecture, Database (§17 isolation harness), Security (SDR-0012),
Backend (§18), API (APDR-0014), Frontend (FEDR-0014), AI (AIDR-0012), Infrastructure (IDR-0011/0014)
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; new test class; quality-gate change.

Canonical testing & quality reference for AIIMS+. It **turns the "testing hooks" defined across every prior
phase into concrete, enforced gates** and does not redesign any frozen decision. Decisions are recorded as
**TDRs**. Consistency review is in §31, freeze report in §32. No implementation code.

**Inherited & non-negotiable:** the **cross-tenant isolation test is a merge-blocking gate** (DDR 0002 /
DB §17); **AI safety evals gate releases** (AIDR-0012); CI security scans are blocking (SDR-0012); **no PHI
in any non-prod/test data** (SDR-0004/0010); web+mobile from shared contracts (FEDR).

---

## 1. Testing Philosophy — TDR-0001

- **Shift-left & risk-based:** catch defects at the cheapest layer; invest most where failure is most costly
  (tenant isolation, PHI, clinical correctness, auth).
- **Tests are quality gates, not decoration** — the pipeline (IDR-0011) blocks on them; coverage is a means,
  not the goal (no coverage theater).
- **Fast feedback:** the pyramid keeps most tests fast/local; slow suites run in CI stages.
- **Safety-critical bias:** for a clinical PHI system, isolation, security, and AI-boundary tests are
  first-class release gates, not "nice to have."
- **Determinism:** flaky tests are bugs; quarantined and fixed, never ignored.

## 2. Testing Pyramid — TDR-0001

```
        /\        E2E (few) — OPD hero flow, web + mobile
       /  \       Integration/API/DB+RLS (some) — real Postgres, contracts
      /----\      Component (some) — UI + module behavior
     /------\     Unit (many) — pure domain logic, fast
    /--------\    Static (foundation) — types, lint, SAST, scans
   +----------+   Specialized gates: RLS isolation · AI evals · security · perf · DR
```
Most tests are unit/component; fewer, higher-value integration/E2E; **specialized safety gates** run
alongside as blocking checks.

## 3. Unit Testing — TDR-0002

- **Vitest/Jest (TS)** for pure **domain logic** (aggregates, value objects, domain services) — no IO, fast,
  deterministic (Backend §4). Frontend units via React/RN Testing Library.
- Focus on **business invariants and edge cases**, not glue. Mocks only at ports/boundaries.
- Target: high coverage of the **domain layer** (the rules that matter), pragmatic elsewhere (§26).

## 4. Integration Testing — TDR-0003

- Application-service + repository against a **real PostgreSQL with RLS** (via **Testcontainers**), run as
  the **`aiims_app` role** so `FORCE RLS` behaves as in prod. Exercises tenant-context transactions, outbox,
  optimistic concurrency (DDR 0002/0007/0009).
- Worker/job integration (BullMQ) incl. **idempotency** and tenant-context in workers (BDR-0007).

## 5. Contract Testing — TDR-0004

- **API contracts:** validate server + typed client against `api-contracts`/OpenAPI (APDR-0014); breaking
  changes fail CI and gate a version bump.
- **Event contracts:** validate outbox/event payloads against `event-schemas` (BDR-0005) — producers and
  consumers stay compatible, enabling the future service split.
- Consumer-driven where external partners/webhooks exist (Production).

## 6. End-to-End Testing — TDR-0005

- **Playwright (web)** + **Detox/Maestro (mobile)** covering the **OPD hero flow** end-to-end: register →
  schedule → check-in → encounter (document) → orders/results → invoice → **mock** share-on-consent.
- Runs against a seeded **staging-like** env with **synthetic data**; auth via test users per role.
- Kept few and high-value (slow); the critical clinical journey is the priority.

## 7. Component Testing — TDR-0005

- UI components (web shadcn/ui, RN) tested in isolation with **accessibility assertions** (§18); shared
  headless hooks tested once, rendered per platform. Visual-regression for the design system.

## 8. API Testing — TDR-0004

- Endpoint-level tests: authN/authZ enforcement, tenant scoping, **Problem-Details** error model, cursor
  pagination, **idempotency** (APDR-0006), rate limiting (429), and the FHIR boundary contract. Negative/
  authz-denial cases are mandatory.

## 9. Database Testing — TDR-0003

- Migration tests (forward + rollback, **expand/contract** safety, DDR 0011), constraint/enum/exclusion
  behavior (double-booking guard, DDR 0009), index presence for key access paths, and **RLS policy
  presence** (a removed policy fails CI — DDR 0011 guardrail).

## 10. RLS Isolation & Multi-Tenancy Testing — TDR-0006 (THE critical gate)

The **merge-blocking backstop** (DDR 0002 / DB §17). Seeds tenants A & B; under `app.tenant_id = A`:
- every access pattern against B's rows (select/update/delete, direct id, join, jsonb path, search) **must
  return 0 / raise**;
- writing B's `tenant_id` under A **must be rejected** (WITH CHECK);
- run as **`aiims_app`** (FORCE RLS exercised);
- **removing a policy must make the suite fail** (guardrail against Drizzle's silent-drop).
Also covers dedicated-DB promotion routing and worker tenant-context. **This is the single most important
test in the repo.**

## 11. AI Evaluation, Safety & Prompt Regression Testing — TDR-0007 (release gate)

Realizes AIDR-0012 as a **release-blocking** suite per AI capability:
- **Boundary/safety tests:** must **refuse diagnosis/treatment** requests (Constitution); any regression
  blocks release.
- **PHI-leak tests:** no PHI in prompts/outputs/logs (SDR-0004/0010); redaction verified.
- **Prompt-injection red-team suite:** adversarial retrieved/user content must not exfiltrate context or
  trigger unsafe actions (AIDR-0009).
- **Grounding/faithfulness + regression sets:** hallucination rate, refusal correctness, citation accuracy
  tracked over time; HITL corrections feed the eval set.
A prompt/model change failing safety evals **cannot ship**.

## 12. Security Testing — TDR-0008

- **SAST** (code), **DAST** (running app), **dependency** scanning, **secrets** scanning, **container** &
  **IaC** scanning — all in CI, **blocking** (SDR-0012). Authz/authn negative tests; RLS tests (§10);
  crypto/secret-handling checks.
- Security review required for authz/RLS/crypto/secrets/infra changes.

## 13. Penetration Testing — TDR-0008

- **External pen-test before production go-live** and periodically thereafter (and after major changes),
  covering OWASP, tenant isolation, auth, and PHI exposure. Findings tracked to closure; criticals gate
  release. (Production/pre-go-live; a documented exit criterion, §30.)

## 14. Performance Testing — TDR-0009

- Per-endpoint latency/throughput budgets tied to **SLOs** (IDR-0013); tested against staging with
  realistic data volumes; regressions vs baseline **fail CI** for hot paths. Query-plan checks for
  tenant-scoped indexes (DB §12).

## 15. Load & Stress Testing — TDR-0009

- **Load** (expected peak) and **stress** (beyond peak → find breaking point) with k6/Locust against
  staging; validates autoscaling (IDR-0015), connection pooling (RDS Proxy), rate limiting, and queue
  backpressure. Multi-tenant load patterns included.

## 16. Chaos Engineering — TDR-0009 (Production maturity)

- Game-day fault injection (AZ loss, DB failover, Redis loss, AI-plane down, dependency latency) to verify
  **graceful degradation** — esp. that **AI failure never blocks care** (AIDR-0014) and clinical flows
  survive component loss. Starts in staging; controlled prod game-days at maturity.

## 17. Accessibility Testing — TDR-0010

- Automated a11y checks (axe) in component + E2E tests; manual screen-reader passes (VoiceOver/TalkBack)
  for critical flows; **WCAG 2.1 AA** as the target and a release criterion for the OPD flow (FEDR-0004).

## 18. Mobile Testing — TDR-0010

- RN unit/component (RN Testing Library), **Detox/Maestro E2E** on device farms (iOS/Android matrix),
  secure-storage + offline-cache behavior, biometric/permission flows, and OTA-update safety (EAS).
  Device/OS matrix defined per release.

## 19. Cross-Browser Testing — TDR-0010

- Playwright across Chromium/Firefox/WebKit; responsive breakpoints (workstation→tablet); the clinical app
  is validated on the supported browser matrix each release.

## 20. Infrastructure Testing — TDR-0011

- **IaC tests:** Terraform validate/plan + policy (tfsec/checkov/OPA) in CI; module unit tests; drift
  detection. Post-deploy **smoke tests** verify env health (IDR-0011).

## 21. Disaster Recovery Validation — TDR-0011

- **DR game-days** validate the IDR-0014 targets (**RPO ≤ 5 min; in-region RTO ≤ 30 min; cross-region
  RTO ≤ 2 h**): simulate region loss, fail over to `ap-south-2`, restore, and measure actuals. A passing DR
  drill is a **production exit criterion** (§30).

## 22. Backup & Restore Validation — TDR-0011

- **Periodic restore drills** (not just backup success): PITR restore, snapshot restore, S3 object recovery,
  audit-WORM integrity check — verifying data is actually recoverable within RPO. Automated where possible.

## 23. CI/CD Quality Gates — TDR-0012 (implements IDR-0011)

Ordered, **merge/deploy-blocking** pipeline: lint → typecheck → unit → component → **integration (RLS,
Testcontainers)** → **cross-tenant isolation gate (§10)** → contract → **AI safety/eval gate (§11)** →
SAST/DAST/dep/secret/container/IaC scans → build → E2E (staging) → perf smoke → deploy (canary). Any red
gate stops the release.

## 24. Code Coverage Policy — TDR-0012

- **Risk-based, not a single blanket number.** Enforced thresholds: **domain/critical modules ≥ 90%**
  (business rules, authz, tenant-context, consent, encryption), **overall ≥ 80%**; **new code** must not
  lower coverage (ratchet). Coverage measures the *right* code — no gaming via trivial tests.

## 25. Static Analysis — TDR-0008

- **TypeScript strict**, ESLint (incl. **import-boundary rules**, BDR-0013), **no-PHI-in-logs** lint,
  Prettier; **SAST** (Semgrep/CodeQL). Static checks are the fast foundation of the pyramid and block merge.

## 26. Dependency & Secrets Scanning — TDR-0008

- **Dependency** vulnerability scanning (Dependabot/Snyk) + license checks; **secrets** scanning
  (gitleaks/trufflehog) blocks committed secrets; SBOM per build; **container** image scanning (Trivy/ECR).
  All blocking in CI (SDR-0012).

## 27. Release Quality Gates — TDR-0012

- A release proceeds only when: all CI gates green, coverage thresholds met, **isolation + AI-safety +
  security scans passed**, E2E OPD flow green, perf within budget, no open criticals, and required reviews
  approved. Feature flags gate risky features independently (ADR 0010).

## 28. Test Data Management — TDR-0013

- **No real PHI in any non-prod environment or test** (SDR-0004/0010). Use **synthetic/anonymized** data
  generators producing India-realistic patients (ABHA-shaped ids, names, coded values from `reference`).
- **Tenant fixtures** (A/B) for isolation tests; deterministic seeds for reproducibility; sensitive fields
  use fake-but-valid formats. Data lifecycle: created/torn-down per suite; no leakage between tenants.

## 29. Test Environment Strategy — TDR-0014

- **Local** (Testcontainers Postgres/Redis) for fast integration; **CI ephemeral** envs per pipeline;
  **Staging** (prod-like, synthetic data) for E2E/perf/DR/pen-test (IDR-0002). Same Terraform modules →
  parity. **No PHI** anywhere but prod.

## 30. Test Observability, Quality Metrics & Production Exit Criteria — TDR-0014

- **Test observability:** results/trends dashboarded — pass rate, flake rate, coverage ratchet, mean test
  time, escaped-defect rate, gate failure reasons. Flaky tests tracked and fixed.
- **Quality metrics:** DORA (lead time, deploy freq, change-fail rate, MTTR), defect density, a11y/perf/SLO
  compliance, AI eval scores, isolation-gate history.
- **Production exit criteria (go-live checklist):** all release gates green; **cross-tenant isolation
  suite green**; **AI safety evals green**; security scans clean + **pen-test criticals closed**;
  **DR + restore drill passed** (RPO/RTO met); **WCAG 2.1 AA** on the OPD flow; perf within SLOs; audit
  integrity verified; DPDP/ABDM compliance items (legal-deferred) resolved for the go-live scope; runbooks
  (Ops phase) in place. **No go-live with any red criterion.**

## 31. Testing Consistency Review (vs frozen foundation)

| Frozen source | Testing position | Consistent? |
|---|---|---|
| DDR 0002 / DB §17 (RLS isolation harness) | §10 formalized as THE merge-blocking gate | ✅ |
| DDR 0009/0011 (concurrency, migration governance) | §9 constraint + migration + policy-presence tests | ✅ |
| SDR 0012 (SAST/dep/secret/container/IaC, gates) | §12/§25/§26 blocking scans | ✅ |
| SDR 0004/0010 (no PHI in logs/data) | §28 synthetic-only, no-PHI lint | ✅ |
| AIDR 0012 (AI eval gates) | §11 release-blocking AI safety/injection/PHI evals | ✅ |
| Backend §18 (test hooks) | §3–§5 units/integration/contract realized | ✅ |
| API APDR-0014 (contract-first) | §5/§8 contract tests gate version bumps | ✅ |
| Frontend FEDR-0014 (a11y, E2E, contract) | §6/§7/§17/§18/§19 realized | ✅ |
| Infra IDR-0011/0014 (CI gates, DR) | §23 gate order; §21/§22 DR/restore drills | ✅ |
| ADR 0010 (progressive) | §27 feature-flag gating; pen-test/chaos phased | ✅ |

**Result: no contradictions, no critical flaws.** Testing turns every prior phase's hooks into enforced
gates and reopens nothing. It also operationalizes the two open security items as **release criteria**
(offline-PHI device posture and LLM-residency must be resolved before those features go live).

## 32. Testing Freeze Report

**Defined & authoritative:**
- [x] Philosophy + pyramid (§1–§2) — TDR-0001
- [x] Unit/integration/contract/E2E/component/API/DB (§3–§9) — TDR-0002/0003/0004/0005
- [x] RLS/multi-tenancy isolation gate (§10) — TDR-0006
- [x] AI eval/safety/prompt-regression (§11) — TDR-0007
- [x] Security, pen-test (§12–§13) — TDR-0008
- [x] Performance, load/stress, chaos (§14–§16) — TDR-0009
- [x] Accessibility, mobile, cross-browser (§17–§19) — TDR-0010
- [x] Infra, DR, backup/restore validation (§20–§22) — TDR-0011
- [x] CI gates, coverage, static/dep/secret scanning, release gates (§23–§27) — TDR-0012/0008
- [x] Test data, environments, observability, metrics, **production exit criteria** (§28–§30) — TDR-0013/0014
- [x] Consistency review (§31) — no contradictions

**Deferred (non-blocking, phased):** external pen-test (pre-go-live), production chaos game-days (maturity),
consumer-driven partner contract tests (when webhooks ship). All are Production-timing, not architecture.

**Freeze status: READY TO FREEZE** on approval. The quality gates that protect every frozen phase are now
defined and enforced. Safe for the Operations phase and for implementation to begin against these gates.

*End of Testing & Quality Architecture v1.0.*
