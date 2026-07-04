# AIIMS+ API Decision Records (APDR) — Index

**Phase:** 5 (API Architecture) · **Owner:** API / Backend Lead · **Date:** 2026-07-04
**Relationship:** APDRs define the API surface over the frozen Backend/Security/DB/Architecture phases;
they contradict none. **Companion:** `API-ARCHITECTURE.md`.

| APDR | Title | Implements | Status | Confidence | Reversibility |
|------|-------|-----------|--------|------------|---------------|
| 0001 | REST + JSON, resource-oriented; GraphQL deferred | Blueprint §13 | Accepted | High | Medium |
| 0002 | URI major versioning + additive-change + deprecation | Blueprint §13 | Accepted | High | Medium |
| 0003 | Response envelope + Problem-Details error + validation | BDR 0009/0010, SDR 0009 | Accepted | High | Medium |
| 0004 | API auth flow (OIDC bearer + BFF + tenant + PEP/PDP) | SDR 0001/0002/0003 | Accepted | High | Low |
| 0005 | Cursor pagination + allow-listed filter/sort | DB §12 | Accepted | High | Medium |
| 0006 | Idempotency-Key + optimistic concurrency | BDR 0004, DDR 0009 | Accepted | High | Medium |
| 0007 | File transfer via presigned S3 URLs | SDR 0004, Blueprint §16 | Accepted | High | Low |
| 0008 | Long-running ops: async 202 + operation resource | BDR 0005/0007 | Accepted | High | Medium |
| 0009 | Realtime: SSE now, WebSockets deferred | Blueprint §17 | Accepted | Med-High | Medium |
| 0010 | Outbound webhooks (signed), Production | ADR 0010, SDR 0004 | Accepted | High | Medium |
| 0011 | Internal/external + public/private + gateway strategy | ADR 0001, Blueprint §17 | Accepted | High | Medium |
| 0012 | FHIR API boundary separation (`/fhir/R4`) | ADR 0003/0006 | Accepted | High | Low |
| 0013 | Rate limiting & quotas (Redis, per tenant/user/IP) | SDR 0009 | Accepted | High | Medium |
| 0014 | Contract-first OpenAPI 3.1 + API governance | Blueprint §13, BDR 0002 | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
