# AIIMS+ — AI Architecture (Phase 7)

**Version:** 1.0 · **Owner:** AI Systems Architect · **Status:** **Frozen (canonical, approved 2026-07-04)**
**Dependencies:** `../architecture/ARCHITECTURE-BLUEPRINT.md` (§10/§28), `../security/SECURITY-BLUEPRINT.md`
(§20, SDR-0011), `../backend/BACKEND-ARCHITECTURE.md` (§9, BDR-0008), `../database/DATABASE-ARCHITECTURE.md`,
`../api/API-ARCHITECTURE.md`, ADR 0010, DDR 0002/0006/0007, SDR-0004/0007/0010/0011
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; new AI capability; regulatory guidance on health AI.

Canonical AI reference for AIIMS+. It **builds on** the frozen phases and does not redesign them. AI
decisions are recorded as **AIDRs**. Consistency review is in §28, freeze report in §29. No implementation code.

> ## THE AI CONSTITUTION (non-negotiable — Master Ch. 19)
> - **AI assists operations.** It optimizes workflow, drafts documentation, retrieves and summarizes,
>   suggests codes — always for a human to accept.
> - **AI never performs diagnosis.**
> - **AI never prescribes or recommends treatment/medication.**
> - **Doctors remain the final decision-makers.** Every AI output touching a clinical artifact requires
>   clinician review and sign-off.
> These are enforced by architecture (§3/§4/§17), not merely by policy text.

---

## 1. Overall AI Philosophy — AIDR-0001

AI in AIIMS+ is an **invisible operational assistant**, never a clinician. It reduces administrative
burden and surfaces information; it does not decide. Design tenets: **human-in-the-loop by default**,
**grounded not generative-from-nothing** (RAG over the org's own data), **least-PHI**, **auditable**,
**provider-abstracted**, and **off the critical path** (care continues if AI is down). AI is a
**consumer of the platform**, reached only through a controlled gateway — never a privileged component.

## 2. AI Governance — AIDR-0001

- **Allowed use-cases** are enumerated and version-controlled; anything not on the list is disallowed by
  default. New use-cases require security + clinical + product sign-off and an AIDR.
- **Ownership:** the AI Systems Architect owns this doc; each AI feature has an owner, an eval suite (§16),
  and a documented HITL step (§17).
- **Change control:** prompts, models, and retrieval sources are versioned and reviewed (§6/§10).
- **Kill switch:** every AI capability is behind a feature flag (§23) and can be disabled instantly.

## 3. AI Boundaries (Constitution enforcement) — AIDR-0001

**Allowed (operational):** documentation drafting (clinician edits/signs), medical-coding *suggestions*
(human-confirmed), summarization of the org's own records, intelligent search/retrieval, ambient
transcription (human-in-loop), scheduling/throughput optimization, administrative Q&A over policies.

**Forbidden (hard):** diagnosis; treatment/medication recommendation; autonomous clinical decisions;
triage that gates care without a clinician; any output presented as clinical authority; any **write** to a
clinical record without human sign-off.

**Technical enforcement:** all access via the AI Gateway (§4); **no AI write path** to clinical data
(§17); outputs are labeled *AI-generated, unverified*; the gateway rejects requests for forbidden
categories; evals (§16) test for boundary violations as release gates.

## 4. AI Gateway — AIDR-0002 (implements BDR-0008, SDR-0011)

The **single ingress/egress** for all AI. The core reaches AI only via the `AiGateway` port; no module
calls a model directly. Responsibilities:
- **Provider abstraction** (model-agnostic; §10/§11), **request/response schema**, versioned prompts.
- **PHI redaction/tokenization before any model call** (§13), and de-tokenization on return within the
  trust boundary.
- **AuthN/authZ + tenant scoping** (a request is bound to one tenant; RAG is tenant-scoped, §7).
- **Guardrails:** input/category checks, output validation, injection defenses (§14), rate limiting (§22),
  caching (§21), **full audit** (§18), cost accounting (§19).
- Runs in the **isolated Python AI plane** (AIDR-0003), feature-flagged, off the critical path (§25).

## 5. LLM Orchestration — AIDR-0004

- **Task-oriented orchestration:** each capability is a defined pipeline (retrieve → assemble prompt →
  call model → validate output → return with citations/labels). Multi-step chains are explicit and bounded
  (no open-ended agentic tool use in clinical contexts).
- **Tool/function calling is allowlisted and read-only** where used; no tool may write clinical data or
  call external systems outside vetted, redacted adapters.
- Deterministic, testable pipelines over free-form agents — safety and evaluability first.

## 6. Prompt Architecture — AIDR-0007

- **Versioned prompt templates** (in `packages`/config, reviewed like code); a strong **system prompt**
  encodes the Constitution and refusal rules; **guardrail prompts** constrain scope and format.
- **Structured inputs only** — retrieved context is inserted in delimited, clearly-untrusted sections
  (§14). **No raw PHI in prompts** beyond redacted/authorized tokens (§13).
- Outputs requested in **validated schemas** (JSON) so they can be checked before use.

## 7. RAG Architecture — AIDR-0005

- **Retrieval over the organization's own operational data only**, **tenant-scoped** (RLS on embeddings,
  §9) — never cross-tenant, never external medical corpora presented as clinical truth.
- Pipeline: chunk → embed → store (§9) → retrieve top-k by similarity + filters → **ground the answer with
  citations** to source records. Ungrounded/low-confidence → the model abstains or defers to a human.
- RAG is for **retrieval/summarization/search**, not clinical inference (Constitution).

## 8. Knowledge Management — AIDR-0005

- **Sources:** tenant operational data (records, policies, schedules) + non-clinical reference content.
  Each source is registered, permissioned, and **tenant-scoped**; indexing respects the same RBAC/RLS as
  the API (a user can only retrieve what they're authorized to see).
- **Freshness:** embeddings updated via the event stream (BDR-0005) when source data changes; stale
  chunks invalidated. Provenance is retained so every answer can cite its sources.
- **No medical knowledge base is treated as clinical authority** — reference content is informational only.

## 9. Vector Database Strategy — AIDR-0006

- **MVP: `pgvector` in Aurora PostgreSQL** — reuses the frozen DB, so **RLS enforces tenant isolation on
  embeddings** (DDR 0002), no new datastore to operate, transactional consistency with source rows.
- **Scale/Production: dedicated vector store** (e.g. OpenSearch k-NN) if volume/latency demands, fed from
  the event stream as a projection (mirrors the search-promotion path, Blueprint §17).
- Embeddings tables carry `tenant_id` + RLS; embedding of PHI is minimized and access-controlled (§13).

## 10. Model Selection Strategy — AIDR-0004

- **Provider-abstracted, model-agnostic.** Selection criteria: task fit, **data-residency & privacy**
  (India/DPDP), **no-training-on-our-data** contractual guarantee, latency, and cost.
- **Residency/PHI rule:** models are used **in-region / enterprise-mode with no-retention**; if a model
  endpoint cannot meet residency/no-train requirements, **only redacted, non-PHI** content may be sent —
  or a self-hosted/in-region model is used. (Provider shortlist pending residency/legal confirmation —
  tracked, §29.)
- Small/cheap models for routine tasks; larger models only where justified (§11/§19).

## 11. Model Routing — AIDR-0004

- The gateway **routes by task + sensitivity + cost**: e.g. redaction/classification → small in-region
  model; drafting/summarization → mid-tier; retrieval-augmented Q&A → capable model with grounding.
- **Sensitivity-aware routing:** higher-PHI-risk tasks prefer in-region/self-hosted models; routing rules
  are config-driven and auditable. Fallback routes on provider failure (§25).

## 12. AI Security — AIDR-0009 (implements SDR-0011)

- AI plane is **network-isolated**, reached only via the gateway; its service identity is least-privilege
  and has **no direct DB write** access to clinical tables.
- All model I/O is **audited** (§18); prompts/outputs treated as **untrusted** until validated (§14).
- Secrets (provider keys) via Secrets Manager (SDR-0006); TLS everywhere; no PHI to non-compliant endpoints.

## 13. PHI Protection — AIDR-0008 (implements SDR-0004)

- **Redaction/tokenization before any model call:** direct identifiers removed/tokenized at the gateway;
  de-tokenized only inside the trust boundary on return. **No raw PHI leaves the boundary** to an external
  model.
- **Data minimization:** send the least context needed. **No PHI in prompts, logs, traces, or eval data**
  (SDR-0010). Embeddings of PHI are minimized, tenant-scoped (§9), and access-controlled.
- Aligns with crypto-shred/erasure (ADR 0009): AI-derived stores respect deletion.

## 14. Prompt Injection Defense — AIDR-0009

- **Treat all retrieved/user content as untrusted:** inserted in delimited, labeled sections; the system
  prompt instructs the model to never follow instructions embedded in data.
- **Constrain capability:** allowlisted, read-only tools; **no write path**; bounded output schemas
  validated before use; strip/deny attempts to exfiltrate context or escalate.
- **Output validation:** schema + policy checks; suspicious outputs are blocked and logged (§18). Defense
  assumes injection *will* be attempted (assume-breach, SDR).

## 15. AI Observability — AIDR-0011

- **Traces** span core → gateway → model → response (OTel, correlation ids); **metrics:** latency, tokens,
  cost, cache hit-rate, error/refusal rates, guardrail triggers.
- **No PHI** in telemetry (SDR-0010). Model/version, prompt-version, and route are tagged for analysis.
- Alerts on cost spikes, error/hallucination-flag surges, injection-defense triggers, and eval regressions.

## 16. AI Evaluation — AIDR-0012

- **Eval harness per capability:** correctness/faithfulness (grounding), **boundary/safety tests** (must
  refuse diagnosis/treatment), PHI-leak tests, injection red-team suites, regression sets. **Evals gate
  releases** — a prompt/model change failing safety evals cannot ship.
- Human review of samples; feedback loop from HITL corrections (§17) into eval sets.
- Tracks hallucination rate, refusal correctness, and grounding/citation accuracy over time.

## 17. Human-in-the-Loop Workflows — AIDR-0010 (Constitution)

- **Every AI output touching a clinical artifact is a suggestion** presented for clinician review; the
  clinician edits/accepts/rejects and **signs** (the sign action is human-only). AI never auto-commits to a
  clinical record.
- Outputs are labeled **"AI-generated — verify"**; acceptance is audited with who/what/when (§18).
- Corrections feed evaluation (§16). Operational (non-clinical) AI (e.g. schedule suggestions) still
  surfaces to a human actor.

## 18. AI Audit Logging — AIDR-0011 (implements DDR 0007, SDR-0007)

- **Every AI interaction is audited** via the outbox/append-only log: actor, tenant, capability, model +
  version, prompt-version, **redacted** input reference, output reference, route, decision (accepted/
  rejected by human), outcome. Hash-chained, tamper-evident, **no raw PHI**.
- Enables accountability ("why did the model produce this, and who accepted it") for compliance and safety.

## 19. AI Cost Optimization — AIDR-0013

- **Right-size models** per task (§11); prefer small models + RAG grounding over large-model brute force.
- **Token budgets** per capability/tenant; **caching** (§21) of embeddings and deterministic responses;
  batch embedding jobs. **Cost is metered per tenant/capability** (§15) for visibility and quotas.
- Guardrails prevent runaway loops (bounded chains, max tokens/steps).

## 20. AI Scalability — AIDR-0003

- The AI plane is **stateless and horizontally scalable** (separate Fargate service); embedding/generation
  jobs run as **async workers** (BullMQ) off the request path. Vector search scales via pgvector indexes →
  dedicated store at scale (§9).
- Backpressure via rate limiting (§22) and queues; AI load never degrades core clinical APIs (isolation).

## 21. AI Caching — AIDR-0013

- **Embedding cache** (content hash → vector) avoids recompute; **response cache** only for
  **deterministic, non-PHI** prompts (e.g. policy Q&A) with tenant-scoped keys and TTLs. **PHI-bearing
  responses are not cached** by default (SDR-0004). Cache invalidation follows source-data events.

## 22. AI Rate Limiting — AIDR-0013

- Per-tenant/user/capability limits at the gateway (Redis), protecting cost and providers; **429**/queue
  on breach. Prevents abuse and runaway spend; integrates with API rate limiting (APDR-0013).

## 23. AI Feature Flags — AIDR-0001 (implements ADR 0010)

- Every AI capability is **feature-flagged** per tenant/user — dark-launch, gradual rollout, instant
  **kill switch**. MVP may ship the gateway with capabilities **stubbed/off**; real models enabled
  progressively (Blueprint §10 timing). No AI capability is on by default without governance sign-off.

## 24. AI Deployment Strategy — AIDR-0003

- **Isolated Python AI plane** (`apps/ai`, FastAPI) deployed as its own Fargate service, versioned and
  released independently of the core; CI runs **safety/eval gates** (§16) before deploy. Provider keys via
  Secrets Manager. Canary rollout; flags decouple deploy from enablement.
- **The AI plane is optional infrastructure** — the platform runs fully without it (fail-safe, §25).

## 25. AI Fail-safe Mechanisms — AIDR-0014

- **AI is never on the critical path of care.** If the AI plane is down, slow, or returns low-confidence
  output, **clinical workflows continue** without it; UIs degrade gracefully (the human just does the task).
- **Circuit breakers + timeouts + fallback routes** (§11) on provider failure; low-confidence/ungrounded →
  **abstain and defer to human**, never guess. Guardrail failure ⇒ block + audit, not silent pass.

## 26. AI Compliance — AIDR-0001

- **Constitution** (§3) is the primary compliance boundary; **DPDP** (PHI redaction, residency, no-train,
  audit, erasure) and **ABDM** (AI never gates consent/exchange) are respected. AI processing is disclosed
  and consented per DPDP where applicable.
- Every AI feature carries a documented purpose, HITL step, eval suite, and audit trail — the compliance
  package for that capability.

## 27. AI Roadmap

1. **MVP:** AI Gateway + boundaries + audit + flags in place; capabilities **stubbed/limited** (e.g. coding
   suggestions, documentation drafting) behind HITL; pgvector RAG on tenant data.
2. **Production:** enable vetted operational capabilities with full evals; residency-compliant provider(s)
   selected; response caching; cost dashboards.
3. **Scale:** dedicated vector store; more capabilities (ambient transcription, throughput optimization);
   richer evals/red-teaming.
4. **Future:** deeper operational intelligence — always within the Constitution; **never** diagnostic.

## 28. AI Consistency Review (vs frozen foundation)

| Frozen source | AI position | Consistent? |
|---|---|---|
| Constitution (Master Ch. 19) | §3 hard boundaries, §17 HITL, no clinical write path | ✅ Enforced by architecture |
| Blueprint §10/§28 (operational AI, isolated plane, port) | §1–§4 gateway + isolated plane | ✅ |
| SDR-0011 (AI boundary controls) | §4/§12/§13/§14 redaction, tenant RAG, no write path, audit | ✅ Extends |
| SDR-0004 (PHI redaction) | §13 redaction before egress; no PHI in prompts/logs | ✅ |
| SDR-0007 / DDR-0007 (audit) | §18 outbox-fed, hash-chained AI audit | ✅ |
| SDR-0010 (no PHI in telemetry) | §15 redacted observability | ✅ |
| DDR-0002 (RLS tenancy) | §9 RLS on embeddings; tenant-scoped RAG | ✅ |
| BDR-0008 (ports & adapters) | §4 AiGateway port, mock/flagged | ✅ |
| ADR 0010 (integrate progressively) | §23 flags, §24 stubbed→real | ✅ |
| ADR 0007 (India residency) | §10 residency/no-train model rule | ✅ (provider selection deferred) |
| API (APDR-0013 rate limiting) | §22 gateway limits integrate | ✅ |

**Result: no contradictions, no critical flaws.** The AI architecture is a strict, Constitution-compliant
consumer of the frozen platform. **One item is deferred, not a conflict:** the **specific LLM provider(s)**
must be confirmed against DPDP data-residency + no-training guarantees before external models are enabled
(§10/§29) — until then, only redacted/non-PHI content or in-region/self-hosted models are used.

## 29. AI Freeze Report

**Defined & authoritative:**
- [x] Philosophy, governance, Constitution boundaries (§1–§3) — AIDR-0001
- [x] AI Gateway, orchestration, prompt architecture (§4–§6) — AIDR-0002/0004/0007
- [x] RAG, knowledge mgmt, vector DB (§7–§9) — AIDR-0005/0006
- [x] Model selection & routing (§10–§11) — AIDR-0004
- [x] AI security, PHI protection, injection defense (§12–§14) — AIDR-0009/0008
- [x] Observability, evaluation, HITL, audit (§15–§18) — AIDR-0011/0012/0010
- [x] Cost, scalability, caching, rate limiting, flags, deployment, fail-safe (§19–§25) — AIDR-0013/0003/0014
- [x] Compliance, roadmap (§26–§27)
- [x] Consistency review (§28) — no contradictions

**Deferred (non-blocking):** LLM provider shortlist (residency/no-train/legal confirmation); dedicated
vector store (scale); enabling real capabilities (progressive, behind flags + evals). None changes a frozen
decision or blocks the MVP (AI ships gateway + boundaries + audit with capabilities stubbed/flagged).

**Freeze status: READY TO FREEZE** on approval. The AI architecture complies with the Constitution by
construction and is a faithful consumer of the frozen Architecture, Database, Security, Backend, API, and
Frontend phases. Safe for Infrastructure, Testing, and later phases.

*End of AI Architecture v1.0.*
