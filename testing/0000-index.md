# AIIMS+ Testing Decision Records (TDR) — Index

**Phase:** 9 (Testing & Quality) · **Owner:** QA / Engineering Lead · **Date:** 2026-07-04
**Relationship:** TDRs turn the "testing hooks" from every prior phase into enforced gates; contradict none.
**Companion:** `TESTING-ARCHITECTURE.md`.

| TDR | Title | Implements | Status | Confidence | Reversibility |
|-----|-------|-----------|--------|------------|---------------|
| 0001 | Testing philosophy + pyramid (shift-left, risk-based) | All phases | Accepted | High | Medium |
| 0002 | Unit testing (pure domain, Vitest/RTL) | Backend §4/§18 | Accepted | High | Medium |
| 0003 | Integration + DB testing (real Postgres + RLS, Testcontainers) | DDR 0002/0007/0009 | Accepted | High | Medium |
| 0004 | Contract testing (api-contracts + event-schemas) | APDR 0014, BDR 0005 | Accepted | High | Medium |
| 0005 | E2E + component testing (Playwright/Detox, OPD flow) | FEDR 0014 | Accepted | High | Medium |
| 0006 | RLS / multi-tenancy isolation gate (merge-blocking) | DDR 0002, DB §17 | Accepted | High | Very low |
| 0007 | AI evaluation, safety & prompt-regression (release gate) | AIDR 0012 | Accepted | High | Low |
| 0008 | Security testing + pen-test + static/dep/secret scanning | SDR 0012 | Accepted | High | Medium |
| 0009 | Performance, load/stress, chaos | IDR 0013/0015, AIDR 0014 | Accepted | Med-High | Medium |
| 0010 | Accessibility, mobile, cross-browser | FEDR 0004 | Accepted | High | Medium |
| 0011 | Infra, DR & backup/restore validation | IDR 0011/0014 | Accepted | Med-High | Medium |
| 0012 | CI/CD quality gates + coverage policy + release gates | IDR 0011 | Accepted | High | Medium |
| 0013 | Test data management (synthetic, no PHI) | SDR 0004/0010 | Accepted | High | Low |
| 0014 | Test environments, observability, metrics, production exit criteria | IDR 0002 | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
