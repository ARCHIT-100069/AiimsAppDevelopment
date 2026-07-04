# AIIMS+ Database Decision Records (DDR) — Index

**Phase:** 2 (Database Architecture) · **Date:** 2026-07-04
**Relationship to ADRs:** DDRs record **database-level** decisions. They implement, and never contradict,
the frozen ADRs (0001–0011) and `DATABASE-ARCHITECTURE.md`. Where a DDR refines an ADR, it cites it.
**Authoring authority:** Engineering Leadership (Database Architecture).

| DDR | Title | Implements | Status | Confidence |
|-----|-------|-----------|--------|------------|
| 0001 | UUIDv7, application-generated primary keys | ADR 0002/0011 | Accepted | High |
| 0002 | RLS enforcement: FORCE RLS, fail-closed, `SET LOCAL` context | ADR 0002 | Accepted | High |
| 0003 | Least-privilege Postgres role model | ADR 0002 | Accepted | High |
| 0004 | Bounded-context Postgres schemas | Blueprint §7 | Accepted | Med-High |
| 0005 | FHIR-regenerable hybrid modeling (columns + `fhir_extensions`) | ADR 0003 | Accepted | High |
| 0006 | PHI encryption: identifiers-only + blind index + KMS envelope | ADR 0009 | Accepted (Security sign-off pending) | Med-High |
| 0007 | Transactional outbox + append-only hash-chained audit | ADR 0005 | Accepted | High |
| 0008 | Tenant-scoped referential integrity | ADR 0002 | Accepted | High |
| 0009 | Optimistic concurrency + slot exclusion constraint | Blueprint §26 | Accepted | High |
| 0010 | Time-range partitioning for high-volume tables | ADR 0001 | Accepted | High |
| 0011 | Migration governance: RLS/roles as reviewed SQL | ADR 0011 | Accepted | High |
| 0012 | Coded concepts & global reference data | ADR 0003 | Accepted | High |
| 0013 | Soft-delete, retention metadata & clinical versioning | ADR 0009 | Accepted (durations deferred) | Med-High |

## Standard DDR structure
Context · Decision · Alternatives considered · Trade-offs · Consequences · Confidence.

## Companion documents
- `../DATABASE-ARCHITECTURE.md` — full Phase-2 design these DDRs summarize.
- `../adr/` — the frozen architecture decisions these implement.
