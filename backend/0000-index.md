# AIIMS+ Backend Decision Records (BDR) — Index

**Phase:** 4 (Backend Architecture) · **Owner:** Principal Engineer · **Date:** 2026-07-04
**Relationship:** BDRs realize the frozen ADRs/DDRs/SDRs in backend structure; they do not contradict them.
**Companion:** `BACKEND-ARCHITECTURE.md`.

| BDR | Title | Implements | Status | Confidence | Reversibility |
|-----|-------|-----------|--------|------------|---------------|
| 0001 | Layered module architecture (controller/application/domain/repository) | ADR 0001 | Accepted | High | Medium |
| 0002 | Module boundaries & communication (interface + events only) | Blueprint §7, DDR 0004 | Accepted | High | Medium |
| 0003 | Repository pattern & Drizzle confinement | DDR 0011, ADR 0011 | Accepted | High | Medium |
| 0004 | Transaction boundary = application service (UoW + tenant ctx + outbox) | DDR 0002/0007 | Accepted | High | Low |
| 0005 | Event flow via outbox dispatcher (in-process bus + BullMQ) | DDR 0007, ADR 0001 | Accepted | High | Medium |
| 0006 | CQRS-lite (read-model projections, not event sourcing) | Blueprint §26 | Accepted | High | Medium |
| 0007 | Background jobs on BullMQ | Blueprint §15 | Accepted | High | Medium |
| 0008 | Integration ports & adapters (mock default + flags) | ADR 0010/0004/0006, SDR 0011 | Accepted | High | Low |
| 0009 | Layered validation strategy | SDR 0009, DDR 0008/0012 | Accepted | High | Medium |
| 0010 | Error taxonomy & response envelope | SDR 0009/0010 | Accepted | High | Medium |
| 0011 | Configuration & secrets management | SDR 0006, ADR 0010 | Accepted | High | Medium |
| 0012 | Cross-cutting middleware order & observability | SDR 0001/0002/0003/0007/0010 | Accepted | High | Low |
| 0013 | Dependency-direction enforcement (ports & adapters, import boundaries) | ADR 0011 | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
