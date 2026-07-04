# AIIMS+ — Operations & SRE Architecture (Phase 10)

**Version:** 1.0 · **Owner:** SRE / Operations Lead · **Status:** Proposed → (Frozen on approval)
**Dependencies:** all frozen phases — esp. Infrastructure (IDR-0011/0013/0014), Security (SDR-0007/0013),
Testing (TDR-0011/0014), AI (AIDR-0014), DB/audit (DDR-0007)
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; major incident; SLO/on-call change.

The final architecture phase — how AIIMS+ is **run** in production. It builds on the frozen phases and does
not redesign them. Decisions are recorded as **ODRs**. Consistency review is in §31, freeze report in §32.
No implementation code. **This phase completes the AIIMS+ Engineering Operating System.**

**Inherited & non-negotiable:** AI is never on the critical path (AIDR-0014); audit is tamper-evident and
verified (DDR-0007/SDR-0007); no PHI in telemetry/alerts (SDR-0010); DR targets RPO ≤ 5 min / RTO in-region
≤ 30 min / cross-region ≤ 2 h (IDR-0014); production exit criteria are a hard gate (TDR-0014).

---

## 1. Operational Philosophy — ODR-0001

- **Reliability is a feature** — for a clinical system, uptime and correctness are patient-safety concerns.
- **You build it, you run it (lite):** engineers own their services in production; SRE provides the platform,
  practices, and guardrails. A small team, so **toil is automated away** relentlessly.
- **Blameless culture:** incidents are systems failures, not people failures; every incident yields learning.
- **Error budgets balance velocity and stability** — ship fast until the budget is spent, then stabilize.
- **Operability is designed-in** (health checks, observability, runbooks), not bolted on.

## 2. SRE Model — ODR-0001

- **Platform + embedded ownership:** a lean SRE function owns IaC, observability, incident process, and DR;
  service teams own their SLOs and on-call. Given two founders at MVP, roles are shared; the model scales to
  a dedicated SRE as the team grows.
- **Toil budget:** manual operational work is measured and capped; recurring toil becomes automation backlog.

## 3. Service Level Objectives (SLOs) — ODR-0002

Per user-facing service, with **error budgets** (1 − SLO). Proposed MVP targets (tuned with data):
- **API availability:** 99.9% (monthly) for core clinical endpoints.
- **API latency:** p95 < 300 ms reads / < 800 ms writes on hot paths.
- **OPD hero flow success rate:** ≥ 99.5%.
- **Async job success:** ≥ 99.9% within SLA (e.g. notifications < 2 min).
- **Data durability:** effectively 100% (Aurora + backups); **RPO ≤ 5 min** (IDR-0014).
SLOs are reviewed quarterly and after major changes.

## 4. Service Level Indicators (SLIs) — ODR-0002

Measured from telemetry (IDR-0013), **no PHI**:
- Availability (successful/total requests), latency distributions, error rate, saturation (CPU/mem/conns/
  queue depth), job success/latency, replica lag, audit-integrity check status, AI guardrail/eval status.
- SLIs are defined per service with explicit good-event criteria and measurement windows.

## 5. Error Budgets — ODR-0002

- **Budget = 1 − SLO** over the window. **Policy:** budget healthy → ship features; **budget exhausted →
  freeze risky changes, prioritize reliability** until recovered. Budget burn alerts (fast/slow burn) page
  on-call. Repeated exhaustion triggers an architecture/reliability review.

## 6. Incident Response Process — ODR-0003 (implements SDR-0013)

- **Severities:** SEV1 (patient-safety/PHI breach/full outage) → SEV4 (minor). Clear definitions + examples.
- **Roles:** Incident Commander, Comms Lead, Ops/Eng responders; **blameless postmortem** for SEV1/2 with
  action items tracked to closure.
- **Lifecycle:** detect → declare → triage → mitigate → resolve → postmortem. **Containment levers**
  (SDR-0013): revoke tokens/keys, isolate tenant/service, rotate secrets, disable feature flag.
- **Breach path:** suspected PHI breach → security incident + DPDP notification workflow (Board + affected
  principals within the mandated window; §23).

## 7. On-call Strategy — ODR-0004

- **Follow-the-team rotation** (24/7 for a clinical system); primary + secondary; humane load (small team →
  automate + tune alerts to avoid fatigue). On-call has the access, runbooks, and authority to act.
- **Alert quality is an SLO:** every page must be actionable; noisy alerts are bugs (§16).

## 8. Escalation Policies — ODR-0004

- Tiered escalation: primary → secondary → eng lead → founders/CTO; **security incidents** escalate to the
  Security Architect immediately; **patient-safety** incidents escalate fastest. Time-based auto-escalation
  if unacknowledged. External vendors (AWS, providers) engaged per severity.

## 9. Runbooks — ODR-0005

- **Per-service, versioned runbooks** in `/operations/` (git) for: deploy/rollback, DB failover/restore,
  Redis loss, AI-plane outage, cert/secret rotation, tenant isolation alert, audit-integrity failure, cost
  spike. Each links from its alert. Runbooks are **tested in game-days** (§25) and kept current.

## 10. Playbooks — ODR-0005

- **Scenario playbooks** for higher-level situations: SEV1 outage, suspected PHI breach, DR failover to
  ap-south-2, provider/LLM outage, mass-notification incident, data-restore request. Playbooks orchestrate
  runbooks + comms + decision authority.

## 11. Change Management — ODR-0006

- **Change types:** standard (pre-approved, automated, low-risk), normal (reviewed), emergency (expedited +
  retrospective review). All changes are IaC/PR-based (IDR-0012) and traceable.
- **Change freeze windows** around high-risk periods; **no risky changes when error budget is exhausted** (§5).
- Every production change is auditable (who/what/when) and reversible.

## 12. Release Management — ODR-0006 (implements IDR-0015, TDR-0012)

- **Immutable image promotion** through dev → staging → prod; **release gates** (Testing §27) must be green;
  **feature flags decouple deploy from release** (ADR 0010). Release notes + version/SHA tracked. Scheduled,
  low-risk release cadence with canary by default.

## 13. Production Deployment Procedures — ODR-0007

- **Canary blue/green via CodeDeploy** (IDR-0015): deploy new version to a small slice → **bake + watch SLIs**
  → progressive shift → 100%. **Automated rollback on alarm** (5xx/latency/health). **Expand/contract DB
  migrations** (DDR-0011) run ahead of code so schema changes are always backward-compatible (zero downtime,
  24/7 clinical system). Pre/post-deploy smoke tests (TDR-0011).

## 14. Rollback Strategy — ODR-0007

- **Rollback = redeploy the prior immutable image digest** (fast, deterministic). DB rollbacks use the
  contract phase of expand/contract (never destructive in one step). Feature-flag kill-switch for instant
  disable without a deploy. Every release has a documented rollback path before it ships.

## 15. Operational Dashboards — ODR-0008

- **Service dashboards:** SLO/error-budget burn, latency/error/throughput (RED), saturation (USE), queue
  depth, replica lag. **Business/flow dashboards:** OPD hero-flow health, registrations, appointment
  throughput. **Security/compliance:** authz denials, isolation anomalies, audit-integrity status, AI
  guardrail triggers. **Cost dashboards** (per tenant/service, incl. AI tokens). **No PHI** on any dashboard.

## 16. Alert Management — ODR-0008

- **Symptom-based, actionable alerts** tied to SLO burn (fast/slow) and hard failures (audit-integrity,
  isolation anomaly, DR/backup failure, security events). Every alert links a runbook. **Alert hygiene** is
  tracked (noise, flapping, MTTA/MTTR); non-actionable alerts are removed. Paging vs ticket by severity.

## 17. Capacity Planning — ODR-0009

- **Data-driven:** trend SLIs/saturation + tenant growth to forecast capacity; autoscaling (IDR-0015) handles
  short-term, planning handles structural (replicas, partitioning trigger per DDR-0010, dedicated-DB
  promotion per ADR-0002). Load tests (TDR-0009) validate headroom before onboarding large tenants.

## 18. Performance Monitoring — ODR-0009

- Continuous p50/p95/p99 latency, error rates, and query performance (slow-query + plan monitoring for
  tenant-scoped indexes, DB §12). Regressions vs baseline alert; perf budgets enforced in CI (TDR-0009).

## 19. Cost Monitoring — ODR-0009

- **FinOps:** per-tenant/per-service cost tags, budgets + anomaly alerts, AI token-cost metering (AIDR-0013),
  Spot/Savings-Plan utilization, non-prod auto-stop review. Cost is an operational KPI (§30); unit economics
  (cost per tenant/encounter) tracked for the business model.

## 20. Security Operations (SecOps) — ODR-0010 (implements SDR-0008/0012)

- **Continuous:** GuardDuty/CloudTrail/Config monitoring, vulnerability triage + patch SLAs, dependency/image
  CVE response, **secret/key rotation operations** (KMS/Secrets Manager), WAF tuning, least-privilege access
  reviews. Security alerts route to the on-call + Security Architect (§8). Threat detection feeds incident
  response (§6).

## 21. Audit Operations — ODR-0011 (implements DDR-0007, SDR-0007)

- **Scheduled audit-integrity verifier** re-walks the hash chain; failure is a high-severity alert. Audit
  archived to WORM (S3 Object Lock) in the security account; access to audit is itself audited and
  least-privilege. Retention per policy; audit availability supports investigations and compliance.

## 22. Compliance Operations — ODR-0011

- **Operational compliance duties:** DPDP records-of-processing upkeep, consent-manager operations (Prod),
  data-principal rights request handling (access/correction/erasure via retention engine, ADR-0009), ABDM
  operational obligations, and — if classified — **Significant Data Fiduciary** duties (DPO, DPIA, audits).
  Compliance calendar + evidence collection are operational tasks.

## 23. Disaster Recovery Operations — ODR-0012 (implements IDR-0014)

- **DR runbook** for failover to `ap-south-2`; decision authority + comms defined. Targets: **RPO ≤ 5 min;
  in-region RTO ≤ 30 min; cross-region RTO ≤ 2 h**. **Business RTO sign-off** is an operational readiness item
  (§27) — Ops owns confirming the number with the business. DR is exercised, not assumed (§25).

## 24. Backup Validation — ODR-0012 (implements TDR-0011)

- **Scheduled restore drills** (PITR, snapshot, S3, audit-WORM integrity) prove recoverability within RPO;
  results tracked; a failed drill is a high-severity item. Backups + restores are encrypted + audited.

## 25. Game Day Exercises — ODR-0012

- Regular **game-days**: DR failover, DB/Redis/AI-plane loss, dependency latency, security-incident and
  breach simulations, and **SEV1 drills**. Validate runbooks/playbooks, alert efficacy, and MTTR; findings
  feed continuous improvement (§30). Staging first; controlled prod game-days at maturity.

## 26. Business Continuity — ODR-0012

- **BCP** beyond infra: degraded-mode operating procedures (hospitals must function if the platform is
  impaired), manual fallbacks for critical clinical steps, communication plans with tenant hospitals, and
  RTO/RPO commitments in customer SLAs. AI/notification outages never block care (AIDR-0014).

## 27. Operational Readiness Reviews (ORR) — ODR-0013

- **Before onboarding a new tenant or major feature to prod:** an ORR checks SLOs defined, dashboards +
  alerts wired, runbooks present + tested, on-call ready, capacity validated, security/compliance signed off,
  and rollback proven. ORR is a gate, not a formality.

## 28. Production Readiness Checklist — ODR-0013 (with TDR-0014)

Go-live requires (superset with Testing §30): all release + quality gates green; **isolation suite green**;
**AI safety evals green**; **pen-test criticals closed**; **DR + restore drill passed** and **business RTO
signed off**; SLOs + error budgets + dashboards + alerts live; **on-call + runbooks + escalation ready**;
audit verifier running; DPDP/ABDM go-live-scope duties operational; **offline-PHI device posture and LLM
residency resolved** if those features are enabled. **No red item → no go-live.**

## 29. Documentation Governance (Operational) — ODR-0014

- Runbooks/playbooks/postmortems are **living docs** in git, versioned, owned, and **reviewed after every
  incident/game-day**. They carry the standard governance header (GOVERNANCE §2). Stale runbooks are a
  tracked defect. This extends the project's documentation governance into day-2 operations.

## 30. Operational KPIs & Continuous Improvement — ODR-0014

- **KPIs:** SLO attainment, error-budget burn, **DORA** (lead time, deploy freq, change-fail rate, MTTR),
  MTTA, incident count/severity, toil %, alert-noise ratio, cost per tenant/encounter, audit-integrity pass
  rate, DR-drill success.
- **Continuous improvement:** postmortem action items, game-day findings, and KPI trends feed a standing
  reliability backlog; quarterly operational review adjusts SLOs, capacity, and automation priorities.

## 31. Operations Consistency Review (vs frozen foundation)

| Frozen source | Operations position | Consistent? |
|---|---|---|
| IDR-0013 (observability) | §4/§15/§16 SLIs, dashboards, alerts on that telemetry | ✅ |
| IDR-0014 (DR, RPO/RTO) | §23/§24 DR ops + restore drills to those targets | ✅ |
| IDR-0015 (blue/green, autoscale, cost) | §13/§14/§17/§19 deploy/rollback, capacity, FinOps | ✅ |
| SDR-0013 (incident response, breach) | §6 IR process + breach path | ✅ |
| SDR-0007 / DDR-0007 (tamper-evident audit) | §21 scheduled integrity verifier + WORM | ✅ |
| SDR-0008/0012 (SecOps, scanning, rotation) | §20 continuous SecOps | ✅ |
| SDR-0010 (no PHI in telemetry) | §4/§15 no-PHI SLIs/dashboards | ✅ |
| AIDR-0014 (AI off critical path) | §26 degraded-mode BCP; AI outage never blocks care | ✅ |
| ADR 0009 (retention/erasure) | §22 data-principal rights ops | ✅ |
| TDR-0014 (production exit criteria) | §28 readiness checklist (superset) | ✅ |
| DDR-0002/0010, ADR-0002 (tenancy/partitioning/promotion) | §17 capacity levers | ✅ |
| Open items (offline-PHI, LLM residency, business RTO) | §23/§28 tracked as readiness gates | ✅ Operationalized |

**Result: no contradictions, no critical flaws.** Operations runs the frozen platform faithfully and turns
the remaining open items (business RTO sign-off, offline-PHI device posture, LLM residency) into explicit
**production-readiness gates** rather than loose ends.

## 32. Operations Freeze Report

**Defined & authoritative:**
- [x] Philosophy + SRE model (§1–§2) — ODR-0001
- [x] SLOs/SLIs/error budgets (§3–§5) — ODR-0002
- [x] Incident response, on-call, escalation (§6–§8) — ODR-0003/0004
- [x] Runbooks + playbooks (§9–§10) — ODR-0005
- [x] Change + release mgmt (§11–§12) — ODR-0006
- [x] Deploy procedures + rollback (§13–§14) — ODR-0007
- [x] Dashboards + alerts (§15–§16) — ODR-0008
- [x] Capacity, performance, cost monitoring (§17–§19) — ODR-0009
- [x] SecOps (§20) — ODR-0010
- [x] Audit + compliance ops (§21–§22) — ODR-0011
- [x] DR ops, backup validation, game-days, BCP (§23–§26) — ODR-0012
- [x] ORR + production readiness checklist (§27–§28) — ODR-0013
- [x] Doc governance + KPIs + continuous improvement (§29–§30) — ODR-0014
- [x] Consistency review (§31) — no contradictions

**Deferred (non-blocking, execution-time):** business RTO sign-off; production chaos/game-day cadence at
maturity; SDF/DPO appointment if classified; SIEM/advanced anomaly detection (Production). All are
operational execution items, not architecture.

**Freeze status: READY TO FREEZE** on approval.

---

## 🏁 AIIMS+ Engineering Operating System — COMPLETE

With Operations frozen, all **ten architecture phases** are defined, consistency-checked, and frozen:
Architecture → Database → Security → Backend → API → Frontend → AI → Infrastructure → Testing → Operations.
The canonical docs, the ADR/DDR/SDR/BDR/APDR/FEDR/AIDR/IDR/TDR/ODR decision records, the Governance
framework, the Decision Registry, the Roadmap, and the Open-Issues log together form the complete
engineering foundation. **Implementation can now begin against a frozen, coherent, Constitution-compliant
architecture** — starting with Stage 0 of the MVP Roadmap.

*End of Operations & SRE Architecture v1.0.*
