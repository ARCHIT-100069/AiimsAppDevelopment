# AIIMS+ Architecture Decision Records — Index

**Market scope:** India v1 (ABDM / DPDP Act 2023 + DPDP Rules 2025)
**Status of this set:** **Adopted** — ratified by founders 2026-07-04. Consolidated into the canonical
`ARCHITECTURE-BLUEPRINT.md` (Frozen-core). ADR 0009 remains *Deferred for Legal Validation*.
**Authoring authority:** Engineering Leadership (CTO / Architecture)
**Architecture Review phase:** ✅ COMPLETE (2026-07-04). Next phase: **Database Architecture.**

These ADRs record the *irreversible or high-cost-to-reverse* architecture decisions for AIIMS+.
They are grounded in the founder documentation (Master Context Ch. 6–8, 19) but where modern best
practice or the India regulatory reality gives a better answer, the ADR says so explicitly.

This index is **architecture-only**. Documentation gaps, inconsistencies, assumptions, and items
needing founder/legal clarification live in `Open Issues & Assumptions.md`.

## Permanent engineering rule (ADR 0010)
> **Build the architecture once. Integrate progressively.** Mock the integrations, keep the structure.

Every ADR, roadmap item, and non-trivial task is tagged with one of four classes: **Structural
Foundation** (must exist in MVP) · **MVP Implementation** · **Production Implementation** (deferred
behind a seam) · **Future Enhancement**. Each ADR carries a *Phase classification* line.

## Decisions
| ADR | Title | Status | Confidence | Reversibility |
|-----|-------|--------|------------|---------------|
| 0001 | Deployment topology: modular monolith on ECS Fargate | Proposed | High | Medium |
| 0002 | Multi-tenancy: Postgres RLS, promotable to dedicated DB | Proposed | High | **Very low (decide now)** |
| 0003 | Clinical data model: relational core + FHIR R4 facade | Proposed | High | **Very low (decide now)** |
| 0004 | Consent Architecture: Unified Consent Service with Progressive Integration | Proposed | High | Low |
| 0005 | Audit: append-only, tamper-evident event log | Proposed | High | Low |
| 0006 | ABDM integration: isolated adapter, sequenced M1→M4 | Proposed | High | Medium |
| 0007 | Data residency: ap-south-1 primary, ap-south-2 DR | Proposed | High | Medium |
| 0008 | Identity: buy (Keycloak), don't build | Proposed | Med-High | Medium |
| 0009 | Retention & erasure: engineering finalized, durations deferred | **Deferred for Legal Validation** | Medium | **Very low** |
| 0010 | Principle: "Build once, integrate progressively" + 4-way phase classification | **Accepted (permanent rule)** | High | n/a |
| 0011 | ORM selection: **Drizzle** (with guardrails) | **Accepted** | Med-High | **Very low (decided)** |

## Companion documents
- `MVP-ROADMAP.md` — sequenced implementation plan (Stage 0 skeleton → Stage 1 golden path → breadth).
- `Open Issues & Assumptions.md` — documentation gaps, inconsistencies, assumptions, clarifications.

## Constitutional guardrails (non-negotiable, from Master Ch. 19)
- No clinical AI, no diagnosis, no medicine recommendations. Doctors make all clinical decisions.
- Security, privacy, and audit are mandatory platform capabilities, not features.
- AI is permitted for **operations** (scheduling, coding assist, documentation drafting, search,
  human-in-the-loop transcription) and **forbidden** for **diagnostic or treatment decisions**.
