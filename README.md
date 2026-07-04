# AIIMS+ — Engineering Knowledge Base

**Version:** 1.0 · **Owner:** Engineering Leadership (CTO) · **Status:** Accepted
**Dependencies:** `/GOVERNANCE.md` · **Last Updated:** 2026-07-04
**Review Trigger:** documentation structure changes.

This repository is the **single source of truth** for the architecture, decisions, and engineering
knowledge behind AIIMS+ — an India-first, multi-tenant Hospital Operating System. It is organized so any
future contributor or Cowork can build on a frozen foundation without re-litigating settled decisions.

## Start here
1. **`GOVERNANCE.md`** — the rules: document headers, the decision-record template, lifecycle, the
   dependency graph, and what "frozen" means. Read this first.
2. **`DECISION-REGISTRY.md`** — the master index of every document and decision, with status and owners.
3. **`architecture/ARCHITECTURE-BLUEPRINT.md`** — the canonical system architecture (Frozen-core).
4. **`database/DATABASE-ARCHITECTURE.md`** — the database architecture (Frozen).
5. **`ROADMAP.md`** — the sequenced MVP build order (Stage 0 → OPD golden path → breadth).
6. **`IMPLEMENTATION-MASTER-PLAN.md`** — the canonical build plan (Stages 0–9) bridging architecture to code.

## Structure
```
/
├── README.md                     ← you are here
├── GOVERNANCE.md                 ← rules, template, lifecycle, dependency graph
├── DECISION-REGISTRY.md          ← master index of all docs & decisions
├── ROADMAP.md                    ← MVP implementation sequence
├── Open-Issues-and-Assumptions.md← deferred items, assumptions, clarifications
├── architecture/  ARCHITECTURE-BLUEPRINT.md
├── adr/           0000-index.md + ADR-0001..0011
├── database/      DATABASE-ARCHITECTURE.md
├── ddr/           0000-index.md + DDR-0001..0013
├── backend/  api/  frontend/  ai/  security/         ← reserved future phases
├── infrastructure/  testing/  deployment/  operations/ (each has a README stub)
└── product/  research/  legal/
```

## The rules in one screen
- **Frozen = immutable.** Do not redesign frozen Architecture or Database decisions. Change them only via
  the flaw process in `GOVERNANCE.md §6` (security, correctness, scalability, compliance, or business
  viability), which produces a **new version + superseding record**, never a silent edit.
- **Every decision is a record**, using the standard template, numbered per phase prefix
  (ADR, DDR, BDR, APDR, FEDR, AIDR, SDR, IDR, TDR, ODR, PDR).
- **Every document carries the governance header** (Version, Owner, Status, Dependencies, Last Updated,
  Review Trigger).
- **Downstream builds on upstream**, never the reverse (see the dependency graph).
- **Deferred ≠ forgotten** — parked items live in `Open-Issues-and-Assumptions.md` with a trigger.

## Current state
- **Phase 1 — Architecture Review:** ✅ complete & frozen (Blueprint + ADR 0001–0011).
- **Phase 2 — Database Architecture:** ✅ complete & frozen (DB Arch + DDR 0001–0013).
- **Next:** Security or Backend phase (see the Registry's completion ledger).

## Project guardrails (non-negotiable — Constitution, Master Ch. 19)
No clinical AI, no diagnosis, no medicine recommendations; doctors make all clinical decisions; security,
privacy, and audit are mandatory. AI is permitted for operations only.
