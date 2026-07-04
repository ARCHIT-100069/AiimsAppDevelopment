# AI — Phase 7 Documentation

**Status:** Complete — ready to freeze (2026-07-04)
**Record type:** AIDR — AI Decision Record
**Owner:** AI Systems Architect
**Depends on:** architecture/ (§10/§28), security/ (SDR-0011), backend/, database/, api/ (all frozen)
**Last Updated:** 2026-07-04
**Review Trigger:** GOVERNANCE.md §6 flaw process; new AI capability; health-AI regulation

Operational-only AI, **Constitution-compliant by construction** (AI assists operations; never diagnoses;
never prescribes; doctors decide).

Contents:
- `AI-ARCHITECTURE.md` — canonical AI reference (29 sections + consistency review + freeze report).
- `0000-index.md` — AIDR index.
- `AIDR-0001 … AIDR-0014` — AI decision records.

Consistency review vs the frozen phases found **no contradictions**. One deferred item: the **LLM provider
shortlist** must be confirmed against DPDP residency + no-training guarantees before external models are
enabled (AIDR-0004); until then only redacted/non-PHI content or in-region/self-hosted models are used.

- Template & lifecycle: `/GOVERNANCE.md`
- Master index: `/DECISION-REGISTRY.md`
- Frozen upstream (do not redesign): `/architecture/`, `/database/`, `/security/`, `/backend/`, `/api/`, `/frontend/`
