# AIIMS+ — Stage 7 (AI Platform) — Status & Verification Report

**Date:** 2026-07-08 · **Owner:** Founders / Eng · **Plan ref:** `../IMPLEMENTATION-MASTER-PLAN.md` §17
**Purpose:** map every Stage 7 deliverable, exit criterion, and DoD item to verification evidence.
Stage 7 stands up the **operational-only AI plane** with one flagged capability — **Constitution-compliant**:
AI assists operations, never diagnoses/treats/decides, and has **no write path** to clinical records. Built
with a **configurable provider abstraction** that **defaults to mock** and activates a real model only when
credentials are supplied. All Stage 0–6 guarantees preserved. **Stage 8/9 external/AWS items pending (see §remaining).**

## Deliverables (Master Plan §17)

| Deliverable                                                                    | Status      | Evidence                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AiGatewayModule` port + **isolated Python `ai` plane** (AIDR-0002/0003)       | ✅ Verified | `AiGateway` seam (mock default + `HttpAiGateway`→plane); FastAPI plane `apps/ai` with `/v1/ai/suggest`                                                           |
| **Provider abstraction, configurable, mock-default** (this stage's ask)        | ✅ Verified | `AiProvider` (mock \| http OpenAI/Anthropic-compatible); **no `AI_PROVIDER_API_KEY` ⇒ mock** (eval-proven)                                                       |
| **Redaction pipeline** (AIDR-0008)                                             | ✅ Verified | PHI redacted in the Node core AND the plane (defense-in-depth); **live: MRN/phone scrubbed, redactionApplied=true**; eval asserts PHI never reaches the provider |
| One operational capability behind **flag + HITL + eval gate** (AIDR-0010/0012) | ✅ Verified | `coding_assist` (ICD-10) dark behind `ai.coding_assist`; labelled `AI-generated — verify`; release-blocking evals                                                |
| **AI audit** (AIDR-0011)                                                       | ✅ Verified | `ai.suggestion_generated.v1` outbox + `ai.coding_assist` audit — references/provider only, never prompt/PHI                                                      |

## Exit criteria (Master Plan §17) — demonstrated live on compose

| Criterion                                                                        | Status | Evidence                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| AI serves one capability as a **human-reviewed suggestion** (never auto-applied) | ✅     | **live: 200 with `label:"AI-generated — verify"`, codes [R50.9, J06.9]**; response is advisory — no clinical write                          |
| **PHI-redacted before any model call**                                           | ✅     | Node redacts before the gateway; plane redacts before the provider; **live redactionApplied=true**; eval: provider never sees `MRN-…`/email |
| Fully audited                                                                    | ✅     | AI audit row + outbox event per request (references only)                                                                                   |
| **safety/PHI/injection evals green**                                             | ✅     | **8/8 pytest evals** (PHI-leak, injection, clinical-decision refusal, failure-safe, malformed-drop, mock-default) + Node guard tests        |
| AI failure does not block care (AIDR-0014)                                       | ✅     | `HttpAiGateway` degrades a plane/provider error to **empty suggestions**, never an exception; eval-proven                                   |

## Constitution compliance

- **Operational-only.** Only `coding_assist` exists on the surface; the safety gate **refuses clinical-decision
  prompts** (`what should I prescribe…` → **422 live**) and **prompt injection** (`ignore all previous
instructions…` → **422 live**), in both the Node core and the plane.
- **No write path.** A static **AI Constitution gate** test asserts no AI source file imports any clinical-write
  helper (`insertObservation/Condition/Note/ServiceRequest/DiagnosticReport`, `signEncounter…`, `insertPatient…`).
- **Human-in-the-loop.** Every output carries the mandatory literal label (the DTO rejects any other label).
- **RBAC.** `ai:use` is **clinician-only**; **live: front_desk → 403**.
- **Dark by default.** The capability is 404 unless `ai.coding_assist` is enabled per tenant; **live: default → 404**.

## Provider configurability (the stage's core requirement)

- **Default mock, everywhere.** The Node gateway defaults to `MockAiGateway` (no plane needed); the plane defaults
  its provider to `MockProvider` (no model needed). `provider_from_env()` returns mock unless `AI_PROVIDER=http`
  **and** `AI_PROVIDER_API_KEY` is set — proven by an eval.
- **Real model, zero code change.** Set `ADAPTER_AI=real` + `AI_PLANE_URL` (Node → plane) and, on the plane,
  `AI_PROVIDER=http` + `AI_PROVIDER_API_KEY` (+ optional `AI_PROVIDER_BASE_URL`/`AI_PROVIDER_MODEL`). No credentials
  are fabricated; the HTTP provider is OpenAI/Anthropic-compatible and lazily imports `httpx`.

## Gate sweep (all green)

| Gate                                                         | Command                            | Result                                                                        |
| ------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| format · build · typecheck · lint                            | `pnpm …`                           | clean · 13/13 · 22/22 · clean                                                 |
| unit (incl. contract + M-1 gate + AI/EMR Constitution gates) | `pnpm test`                        | **94** (contracts 32, api 26, authz 14, crypto 11, events 4, config 3, web 4) |
| **AI safety evals (release-blocking, AIDR-0012)**            | `pytest` (apps/ai)                 | **8/8** — new CI `ai-evals` job (Python 3.12), merge-blocking                 |
| crypto coverage                                              | `pnpm --filter @aiims/crypto test` | 98.5% ≥ 90%                                                                   |
| integration (real Postgres)                                  | `test:integration`                 | **35** (unchanged — AI adds no tables)                                        |
| **isolation gate**                                           | `test:isolation`                   | **19/19**                                                                     |
| RLS policy-diff                                              | `check:rls`                        | all FORCED                                                                    |

**Test totals:** 94 Node unit + 8 Python evals + 35 integration + 19 isolation = **156**. OpenAPI paths: **45**.

## Definition of Done (§20)

| DoD item                                   | Status                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| Implements frozen design; nothing reopened | ✅ — AI-Constitution + AIDR realised; the AiGateway seam is unchanged in shape      |
| Unit + integration + contract tests green  | ✅ 94 + 35; **AI safety evals green (release-blocking)**                            |
| **Isolation suite green**                  | ✅ 19/19                                                                            |
| No PHI in logs/telemetry; audit emitted    | ✅ redaction before any model; AI audit references-only; no PHI logged in the plane |
| Deployed to staging                        | ⏳ AWS-gated (carried forward)                                                      |
| Exit criteria demoed                       | ✅ this report + live AI E2E (dark→RBAC→flag-on→injection→clinical-decision→audit)  |
| Docs updated                               | ✅ this report                                                                      |

## Deviations & notes

- **Isolated plane runtime:** the Python plane (`apps/ai`) is real and runs standalone (FastAPI). In dev/CI the Node
  core uses the in-process mock gateway (no plane process required); the real `HttpAiGateway` calls the plane when
  `ADAPTER_AI=real`. Deploying the plane as a separate service/pod is an infra task (Stage 9/AWS).
- **pgvector RAG (AIDR-0006)** is **not** built in this pass — the shipped capability (coding_assist) does not need
  retrieval, and RAG on tenant PHI needs the LLM-residency decision (AIDR-0004, open founder item). The provider
  seam is ready for it. Flagged as pending.
- **LLM-residency (AIDR-0004)** remains an open founder decision; until made, the real HTTP provider stays disabled
  and the plane runs mock.

## Commits (Stage 7)

| Commit    | Scope                                                                        |
| --------- | ---------------------------------------------------------------------------- |
| `a27d831` | config + AI contracts + event                                                |
| `23ae3a6` | Python AI plane — provider abstraction, redaction, safety, capability, evals |
| `66c4334` | Node AI module + real HttpAiGateway (config-gated)                           |
| `7ef0c68` | Node guards + Constitution gate + authz; CI ai-evals job                     |

---

**Stage 7 is complete and verified.** Operational AI ships behind flag + HITL + redaction + audit + release-blocking
evals, mock-by-default, with a real provider one config away. **pgvector RAG + real LLM pending the residency decision.**
