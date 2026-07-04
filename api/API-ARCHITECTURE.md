# AIIMS+ — API Architecture (Phase 5)

**Version:** 1.0 · **Owner:** API / Backend Lead · **Status:** **Frozen (canonical, approved 2026-07-04)**
**Dependencies:** `../architecture/ARCHITECTURE-BLUEPRINT.md` (§13), `../backend/BACKEND-ARCHITECTURE.md`,
`../security/SECURITY-BLUEPRINT.md`, `../database/DATABASE-ARCHITECTURE.md`, ADR 0003/0006/0010,
DDR 0009, SDR 0001/0002/0003/0004/0009/0010, BDR 0002/0004/0008/0010/0012
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; new API surface class.

Canonical API reference for AIIMS+. It **builds on** the frozen phases and does not redesign them. API
decisions are recorded as **APDRs** (`APDR-0001…`). Consistency review is in §26, freeze report in §27.
No implementation code.

**Inherited & non-negotiable:** RESTful, versioned, consistent error envelope, idempotent clinical writes,
global authN/authZ/tenant/audit middleware, FHIR served **only** at the ABDM boundary (Blueprint §13,
ADR 0003/0006), all controls enforced as middleware (BDR-0012), no PHI in errors/logs (SDR-0004/0010).

---

## 1. API Philosophy & Standards — APDR-0001

- **Resource-oriented REST over JSON** for the application/partner surface; predictable, boring, widely
  tooled. Contracts are the source of truth (`packages/api-contracts`), driving the typed client, server
  validation, and docs (§20).
- **Consistency over cleverness:** uniform naming, envelopes, errors, pagination, and status codes across
  every endpoint.
- **Secure, tenant-scoped, audited by default** (BDR-0012). **FHIR is a separate boundary** (§16), not the
  general REST model.
- **GraphQL is deferred** (Blueprint §13) — may be added later as a read gateway; not in scope now.

## 2. REST Conventions — APDR-0001

- **Nouns, plural, kebab-free snake or lowercase** resource paths: `/v1/patients`, `/v1/encounters/{id}`,
  nested where ownership is real: `/v1/encounters/{id}/observations`.
- **HTTP verbs:** GET (safe), POST (create/action), PUT (full replace), PATCH (partial), DELETE (soft).
- **Status codes:** 200/201/202/204; 400/401/403/404/409/422/429; 500/503 — used consistently (§6).
- **Actions that aren't CRUD** use a sub-resource verb: `POST /v1/encounters/{id}:finalize` (or
  `/actions/finalize`), never overloaded GETs.
- **No verbs in resource names**, no operations hidden in query params, no tunneling.

## 3. API Versioning Strategy — APDR-0002

- **URI major version** (`/v1/…`) — explicit, cache-friendly, unambiguous for partners.
- **Additive, backward-compatible change policy** within a major version: add fields/endpoints freely;
  **never** remove/rename/repurpose a field in-place. Breaking changes ⇒ a new major version.
- **Deprecation** managed via §22 policy (Sunset/Deprecation headers, timelines).
- FHIR resources are versioned by the **FHIR spec** (R4) at their boundary, independently (§16).

## 4. Endpoint Organization — APDR-0011

Endpoints are grouped by **bounded context** (mirrors backend modules, BDR-0002) under the version prefix:
`/v1/patients`, `/v1/appointments`, `/v1/encounters`, `/v1/orders`, `/v1/diagnostic-reports`,
`/v1/invoices`, `/v1/consents`, plus platform `/v1/facilities`, `/v1/departments`, `/v1/users`. Admin and
internal operations live under separated namespaces (§14/§15). The **FHIR** boundary is `/fhir/R4/…` (§16).

## 5. Request/Response Standards — APDR-0003

- **JSON only**; `Content-Type: application/json`; UTF-8; `camelCase` field names in the API layer (mapped
  from domain), ISO-8601 `timestamptz`, money as `{ "amount": "120.00", "currency": "INR" }`.
- **Envelope:** successful responses return the resource (or a `data` + `meta` wrapper for collections).
- **Correlation:** every response carries a request/correlation id header for tracing (§21).
- **Determinism:** stable field ordering not assumed; clients code to names. Unknown fields ignored (tolerant reader).

## 6. Error Model — APDR-0003 (implements BDR-0010, SDR-0009/0010)

- **RFC 9457 Problem Details**-style body: `type`, `title`, `status`, `code` (stable machine code),
  `detail` (safe, no PHI), `correlationId`, optional `errors[]` for field validation.
- **Never leaks** PHI, secrets, or stack traces. 5xx returns a generic message + correlation id only.
- **Canonical mappings:** 409 concurrency (DDR 0009), 422 validation, 403 authz, 404 not-found, 429 rate
  limit, 401 unauth, 503 dependency/degraded.

## 7. Authentication & Authorization Flow — APDR-0004 (implements SDR-0001/0002/0003)

- **Bearer OIDC access tokens** (Keycloak) on every request; browser flows go through the **BFF** so the
  browser holds no long-lived token (SDR-0001).
- **Pipeline (BDR-0012):** AuthN (verify token) → **tenant context** (`SET LOCAL app.tenant_id` from claims)
  → AuthZ (PEP guard → `authz` PDP, RBAC; ABAC/consent-aware ready) → validation → handler → audit.
- **Scopes:** service/machine clients use scoped client-credentials; least privilege.
- Every request is tenant-scoped and authorized; **no endpoint opts out** of the pipeline.

## 8. Pagination, Filtering, Sorting — APDR-0005

- **Cursor-based pagination by default** (stable under inserts; scales better than OFFSET): `?limit=&cursor=`,
  response `meta.nextCursor`. Offset pagination only for small bounded admin lists.
- **Filtering:** explicit allow-listed fields, `?filter[status]=active&filter[from]=…`; no arbitrary field
  filtering (prevents unindexed scans; aligns with DB §12 indexes).
- **Sorting:** allow-listed `?sort=-createdAt`; default deterministic order.
- All list queries are **tenant-scoped** (RLS) and bounded by a max `limit`.

## 9. Idempotency Strategy — APDR-0006 (implements BDR-0004, DDR 0009)

- **`Idempotency-Key` header required on unsafe, non-idempotent POSTs** (create patient, create order,
  payment intent). The key + tenant + endpoint is persisted; a replay returns the original result.
- **PUT/PATCH/DELETE are naturally idempotent**; **optimistic concurrency** (`If-Match`/version) prevents
  lost updates → 409 on conflict (DDR 0009).
- Guarantees safe client retries without duplicate clinical/billing records.

## 10. File Upload / Download APIs — APDR-0007 (implements SDR-0004, Blueprint §16)

- **Files never stream through the API.** Flow: client requests a **short-lived presigned S3 URL** from a
  metadata endpoint (`POST /v1/documents` → returns upload URL + document id), uploads directly to S3
  (SSE-KMS, per-tenant prefix), then confirms; downloads use presigned GET URLs.
- API stores only **metadata** (owner, type, encounter link, checksum) in the DB; DICOM/imaging same pattern.
- Access to a document URL is **authorized + audited**; URLs are time-boxed.

## 11. Long-Running Operations — APDR-0008 (implements BDR-0005/0007)

- **Async pattern:** the API accepts the request, enqueues work (BullMQ), returns **`202 Accepted`** with an
  **operation resource** (`/v1/operations/{id}`) the client polls; terminal states link to the result.
- Completion may also be pushed via **SSE** (§13) or **webhook** (§12).
- Used for: FHIR bundle generation, bulk imports, report generation, ABDM async flows (mock in MVP).

## 12. Event / Webhook Strategy (outbound) — APDR-0010

- **Internal events** use the backend outbox/event bus (BDR-0005) — not HTTP.
- **Outbound webhooks (Production)** let tenant systems subscribe to domain events (e.g. `encounter.finalized`):
  **signed** (HMAC), retried with backoff, delivered from workers, **no PHI in payloads** (references +
  minimal fields; SDR-0004). Subscriptions are per-tenant, authorized, and audited.
- MVP ships the event model; external webhook delivery is a Production integration behind a flag (ADR 0010).

## 13. Realtime APIs (WebSockets / SSE) — APDR-0009

- **Server-Sent Events (SSE)** for server→client realtime (worklist updates, notifications, operation
  completion) in MVP — simple, HTTP/ALB-friendly, one-way, authenticated + tenant-scoped.
- **WebSockets deferred** to when bidirectional/low-latency needs arise (e.g. collaborative editing);
  would require ALB WebSocket support + sticky handling — a Production/Future decision, not MVP.
- Realtime channels enforce the same authN/authZ/tenant scoping; **no PHI beyond the authorized tenant**.
- *Note: SSE is an addition consistent with the frozen infra (HTTP over ALB); it changes no frozen decision.*

## 14. Internal vs External APIs — APDR-0011

- **External (partner/tenant-facing):** versioned `/v1/…`, contract-governed, rate-limited, documented.
- **Internal (service-to-service / BFF→API):** same platform, but internal-only routes (e.g. projection
  rebuilds, admin ops) are network-restricted and not published externally.
- **AI plane and adapters** are reached via internal ports (BDR-0008), never exposed as public endpoints.

## 15. Public vs Private APIs — APDR-0011

- **Private (authenticated, tenant-scoped):** the entire clinical/operational surface — default.
- **Public (unauthenticated):** minimal — health checks, and later a marketing/status surface. **No PHI**
  is ever on a public endpoint.
- Admin APIs are private + elevated-role + heavily audited (break-glass, SDR-0002).

## 16. FHIR API Boundary — APDR-0012 (implements ADR 0003/0006)

- FHIR R4 (India profiles) is served **only** at a dedicated boundary `/fhir/R4/…`, owned by the **ABDM
  adapter** (mock in MVP), **not** the general REST surface. Regenerated from the relational model (ADR 0003).
- Consumers: ABDM HIP/HIU flows, on **consent** (ADR 0004), **encrypted** bundles (SDR-0004).
- This separation keeps the internal REST API fast and stable while remaining FHIR-conformant externally;
  the two evolve independently.

## 17. API Gateway Strategy — APDR-0011

- **Edge:** AWS **ALB + WAF** front the API (Blueprint §17); TLS termination, routing, WAF rules.
- **Application-level gateway** concerns (authN, tenant, authz, rate limit, validation, error envelope) are
  the NestJS middleware pipeline (BDR-0012) — we do **not** add a separate API-gateway product in MVP
  (avoids premature ops; ADR 0001 spirit).
- A managed **partner/API gateway** (e.g. for external developer programs, API keys) is a Production/Future
  option, added behind the same contracts.

## 18. Rate Limiting & Quotas — APDR-0013 (implements SDR-0009)

- **Redis-backed** limits per **tenant + user + IP**, per-endpoint classes (read vs write vs expensive).
- **429** with `Retry-After`; burst + sustained (token-bucket) limits; abusive patterns escalate to WAF.
- **Quotas/tiers** per tenant plan (Production). Protects the DB and ensures fair multi-tenant use.

## 19. Validation — APDR-0003 (implements BDR-0009, SDR-0009)

- **Zod schemas from `api-contracts`** validate every request at the edge (shape/type/range), shared with
  the frontend; reject-by-default → 422 with field `errors[]`.
- Domain invariants (BDR-0009 layer 2) and DB constraints (layer 3) remain the deeper backstops — the API
  layer does **not** duplicate business rules, only structural validation.

## 20. OpenAPI / Swagger Strategy — APDR-0014

- **Contract-first:** `packages/api-contracts` is the source of truth; **OpenAPI 3.1 is generated** from it
  (single source → typed client, server validation, and Swagger UI docs stay in lockstep).
- Docs published per environment; the FHIR boundary documents via its FHIR **CapabilityStatement** separately.
- Contract changes are **reviewed as governance events** (§25); breaking changes gate a version bump (§3).

## 21. API Observability — (implements SDR-0010, BDR-0012)

- Every request carries a **correlation id**; OpenTelemetry traces span edge→API→workers; RED metrics per
  endpoint; **structured logs with no PHI** (SDR-0010).
- Per-endpoint latency/error/throughput SLOs; alerts on error-budget burn, 5xx spikes, 429 surges, and
  auth anomalies. Deprecated-endpoint usage is tracked (§22).

## 22. Deprecation Policy — APDR-0002

- Deprecations announced via **`Deprecation` + `Sunset` headers** and docs, with a **minimum support window**
  (e.g. ≥ 2 minor cycles / a defined calendar period) before removal.
- Usage of deprecated endpoints/fields is **monitored** (§21); consumers are notified before sunset.
- Removal only at a **major version** boundary; never silent.

## 23. API Security Alignment — (implements SDR-0001/0002/0003/0004/0009/0010)

The API realizes the Security Blueprint at the edge: TLS + WAF + security headers + strict CORS; OIDC bearer
auth; tenant-context + RLS; PEP/PDP authz; Zod validation; rate limiting; idempotency; PHI-safe error
envelope; correlation-id logging with redaction; presigned-URL file access. **No new trust surface** beyond
the frozen model; the FHIR boundary is encrypted + consent-gated.

## 24. API Scalability — (implements Blueprint §26)

- **Stateless** API behind ALB → horizontal autoscale on Fargate. **Cursor pagination** + allow-listed
  filters keep queries indexed and bounded (DB §12).
- Expensive reads served from **read-model projections / replicas** (BDR-0006); long work is **async**
  (§11). Redis for rate limiting/cache. Caching honors tenant scoping and never caches PHI in MVP
  (Blueprint §18 caching).

## 25. API Governance — APDR-0014

- **Contract-first + reviewed:** every API change is a PR against `api-contracts`, requiring design review;
  breaking-change detection gates version bumps.
- **Standards enforced** via linting (spectral/OpenAPI lint) in CI: naming, envelope, error model, pagination.
- **Ownership:** each endpoint maps to a bounded-context/module owner (BDR-0002). New public endpoints need
  security + product sign-off. APDRs record significant API decisions.

## 26. API Consistency Review (vs frozen foundation)

| Frozen source | API position | Consistent? |
|---|---|---|
| Blueprint §13 (REST, versioned, envelope, idempotency, FHIR separate, GraphQL later) | §1–§6, §9, §16 mirror exactly | ✅ |
| ADR 0003 (FHIR facade) | §16 FHIR only at `/fhir/R4` boundary, regenerated | ✅ |
| ADR 0006 (ABDM adapter) | §16 FHIR owned by ABDM adapter, consent-gated | ✅ |
| ADR 0010 (build once, integrate later) | §12 webhooks + §17 partner gateway deferred behind flags | ✅ |
| DDR 0009 (optimistic concurrency) | §6/§9 409 + If-Match | ✅ |
| SDR 0001/0002/0003 (auth/authz/tenant) | §7 pipeline = BDR-0012 order | ✅ |
| SDR 0004/0010 (PHI redaction, no-PHI logs) | §6 error model, §10 files, §21 obs, §12 webhooks | ✅ |
| SDR 0009 (API controls, rate limit, validation) | §18/§19/§23 | ✅ |
| BDR 0004/0010 (tx/idempotency, error taxonomy) | §6/§9 map to envelope + codes | ✅ |
| BDR 0002 (module boundaries) | §4/§25 endpoints grouped/owned by context | ✅ |
| Blueprint §16/§17/§18/§26 (storage/edge/cache/scale) | §10 presigned S3, §17 ALB/WAF, §24 scale | ✅ |

**New additions (consistent, not contradictions):** cursor pagination standard, `Idempotency-Key` header,
**SSE** for realtime, signed outbound webhooks — all fit within the frozen infra (HTTP/ALB, Redis, workers)
and change **no** frozen decision. WebSockets and a managed partner gateway are explicitly deferred.

**Result: no contradictions, no critical flaws.** The API architecture is a faithful surface over the frozen
Backend, Security, Database, and Architecture phases.

## 27. API Freeze Report

**Defined & authoritative:**
- [x] Philosophy, REST conventions, versioning, endpoint org (§1–§4) — APDR-0001/0002/0011
- [x] Request/response, error model (§5–§6) — APDR-0003
- [x] AuthN/AuthZ flow (§7) — APDR-0004
- [x] Pagination/filter/sort, idempotency (§8–§9) — APDR-0005/0006
- [x] File transfer, long-running ops (§10–§11) — APDR-0007/0008
- [x] Webhooks, realtime SSE (§12–§13) — APDR-0010/0009
- [x] Internal/external, public/private, FHIR boundary, gateway (§14–§17) — APDR-0011/0012
- [x] Rate limiting, validation, OpenAPI, observability, deprecation (§18–§22) — APDR-0013/0003/0014
- [x] Security alignment, scalability, governance (§23–§25)
- [x] Consistency review (§26) — no contradictions

**Deferred (non-blocking):** WebSockets; managed partner/developer gateway + API keys; outbound webhook
delivery (Production); quota tiers. All behind flags/contracts, no architecture change.

**Freeze status: READY TO FREEZE** on approval. Safe for Frontend (FEDR), AI, Testing, and Infrastructure
phases to build upon.

*End of API Architecture v1.0.*
