# Operations & SRE — Phase 10 Documentation (final architecture phase)

**Status:** Complete — ready to freeze (2026-07-04)
**Record type:** ODR — Operations Decision Record
**Owner:** SRE / Operations Lead
**Depends on:** all frozen phases (esp. Infrastructure, Security, Testing, AI, DB/audit)
**Last Updated:** 2026-07-04
**Review Trigger:** GOVERNANCE.md §6 flaw process; major incident; SLO/on-call change

How AIIMS+ is **run** in production. Completes the AIIMS+ Engineering Operating System.

Contents:
- `OPERATIONS-ARCHITECTURE.md` — canonical operations & SRE reference (32 sections + consistency + freeze + closing summary).
- `0000-index.md` — ODR index.
- `ODR-0001 … ODR-0014` — operations decision records.

Consistency review vs all frozen phases found **no contradictions**. This phase turns the remaining open
items (business RTO sign-off, offline-PHI device posture, LLM residency) into explicit **production-readiness
gates** (§28) rather than loose ends.

- Template & lifecycle: `/GOVERNANCE.md`
- Master index: `/DECISION-REGISTRY.md`
- Frozen upstream (do not redesign): all prior phase folders
