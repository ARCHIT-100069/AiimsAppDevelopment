# AIIMS+ Operations Decision Records (ODR) — Index

**Phase:** 10 (Operations & SRE) · **Owner:** SRE / Operations Lead · **Date:** 2026-07-04
**Relationship:** ODRs define how the frozen platform is run; contradict none. **Companion:**
`OPERATIONS-ARCHITECTURE.md`. This phase completes the AIIMS+ Engineering Operating System.

| ODR | Title | Implements | Status | Confidence | Reversibility |
|-----|-------|-----------|--------|------------|---------------|
| 0001 | Operational philosophy + SRE model | All phases | Accepted | High | Medium |
| 0002 | SLOs, SLIs & error budgets | IDR 0013 | Accepted | High | Medium |
| 0003 | Incident response process (severities, postmortems) | SDR 0013 | Accepted | High | Medium |
| 0004 | On-call strategy + escalation policies | SDR 0013 | Accepted | High | Medium |
| 0005 | Runbooks & playbooks | IDR 0011/0014 | Accepted | High | Medium |
| 0006 | Change & release management | IDR 0012/0015, TDR 0012 | Accepted | High | Medium |
| 0007 | Production deployment procedures + rollback | IDR 0015, DDR 0011 | Accepted | High | Medium |
| 0008 | Dashboards + alert management | IDR 0013, SDR 0010 | Accepted | High | Medium |
| 0009 | Capacity, performance & cost monitoring | IDR 0015, DDR 0010, AIDR 0013 | Accepted | High | Medium |
| 0010 | Security operations (SecOps) | SDR 0008/0012 | Accepted | High | Medium |
| 0011 | Audit & compliance operations | DDR 0007, SDR 0007, ADR 0009 | Accepted | High | Medium |
| 0012 | DR ops, backup validation, game-days, BCP | IDR 0014, TDR 0011 | Accepted | Med-High | Medium |
| 0013 | Operational readiness reviews + production readiness checklist | TDR 0014 | Accepted | High | Low |
| 0014 | Operational KPIs, continuous improvement & doc governance | GOVERNANCE | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
