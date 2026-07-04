# AIIMS+ AI Decision Records (AIDR) — Index

**Phase:** 7 (AI Architecture) · **Owner:** AI Systems Architect · **Date:** 2026-07-04
**Relationship:** AIDRs define the operational-only AI plane over the frozen phases and are bound by the
**AI Constitution**. **Companion:** `AI-ARCHITECTURE.md`.

| AIDR | Title | Implements | Status | Confidence | Reversibility |
|------|-------|-----------|--------|------------|---------------|
| 0001 | Operational-only AI boundary + governance + flags (Constitution) | Master Ch. 19, SDR 0011 | Accepted | High | Very low |
| 0002 | AI Gateway as single ingress/egress | BDR 0008, SDR 0011 | Accepted | High | Low |
| 0003 | Isolated Python AI plane, deployment & scalability | Blueprint §10, ADR 0001 | Accepted | High | Medium |
| 0004 | LLM provider strategy, model selection & routing | ADR 0007/0010 | Accepted (provider shortlist deferred) | Med-High | Medium |
| 0005 | RAG + knowledge management (tenant-scoped, grounded) | DDR 0002 | Accepted | High | Medium |
| 0006 | Vector DB: pgvector (MVP) → dedicated (scale) | DDR 0002, Blueprint §17 | Accepted | High | Medium |
| 0007 | Prompt architecture (versioned, guardrail, structured) | SDR 0011 | Accepted | High | Medium |
| 0008 | PHI protection & redaction before model calls | SDR 0004 | Accepted | High | Low |
| 0009 | AI security + prompt-injection defense | SDR 0011 | Accepted | High | Low |
| 0010 | Human-in-the-loop workflows (Constitution) | Master Ch. 19 | Accepted | High | Very low |
| 0011 | AI audit logging + observability | DDR 0007, SDR 0007/0010 | Accepted | High | Low |
| 0012 | AI evaluation & safety gates | SDR 0011 | Accepted | High | Medium |
| 0013 | AI cost optimization, caching, rate limiting | SDR 0004, APDR 0013 | Accepted | High | Medium |
| 0014 | AI fail-safe & availability (off critical path) | Blueprint §28 | Accepted | High | Low |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
