# AIIMS+ — Open Issues & Assumptions

**Purpose:** Track documentation gaps, inconsistencies, assumptions made during architecture review,
and items needing founder clarification. This is a living document, kept **separate from the ADR Index**
so architecture decisions are not mixed with project/documentation housekeeping.

**Last updated:** 2026-07-03

---

## A. Missing documents
| ID | Item | Impact | Action needed |
|----|------|--------|---------------|
| D-1 | `FOUNDER-A-CONTEXT-PACK.md` — stated highest-authority operating document — is **not present** in the knowledge base. | We may be designing against superseded decisions; the Context Pack overrides the PDFs where they conflict. | Founder A to re-upload. On receipt, reconcile against ADRs 0001–0010. |
| D-2 | Volume IV (Implementation Blueprint & Development Roadmap) exists only as an **OCR-corrupted** file (`All Volumes...compressed-1155-2064.md`) — every heading repeats, body text is garbled. | The most build-relevant volume is unusable; roadmap/sequencing currently relies on inference + the new MVP-ROADMAP. | Provide a clean copy of Volume IV. |

## B. Documentation inconsistencies
| ID | Item | Impact | Action needed |
|----|------|--------|---------------|
| I-1 | The Constitution is cited in project instructions as "Product Bible Vol I, Ch. 20," but in `Master Document 20.md` the **Constitution is Chapter 19**; Chapter 20 is the Founder's Manifesto. | Ambiguity when enforcing the Constitution as a hard gate. | Agree the canonical citation; update instructions or docs to match. |

## C. Assumptions made during architecture review
| ID | Assumption | Basis | Risk if wrong |
|----|-----------|-------|---------------|
| A-1 | v1 regulatory market is **India** (ABDM / DPDP). | Founder decision, 2026-07-03. | Low — confirmed. |
| A-2 | Phase 1 is a **production-quality prototype**, not a legally live platform. | Founder strategy clarification. | Low — confirmed. |
| A-3 | ✅ **CONFIRMED (2026-07-04): OPD (outpatient)** is the Stage 1 hero flow. | Founder confirmation. | Resolved. |
| A-4 | AIIMS+ / the hospital acts as **Data Fiduciary**; SDF classification likely but unconfirmed. | Inference from health-data scale under DPDP. | Medium — affects DPO/DPIA/audit obligations (Production phase). |
| A-5 | In-country data residency (`ap-south-1` / `ap-south-2`) is the required posture. | Health-data sensitivity + ABDM expectations. | Low. |

## D. Items requiring founder / legal clarification
| ID | Item | Owner | Blocks |
|----|------|-------|--------|
| C-1 | Retention durations by record type + erasure-during-retention policy + minors' data handling (ADR 0009). | Founders + legal counsel | Nothing in MVP (schema reserves fields); needed before Production retention engine. |
| C-2 | Data Fiduciary / Significant Data Fiduciary classification (ADR 0009). | Founders + legal counsel | Production compliance duties. |
| C-3 | ✅ **Resolved (2026-07-04)** — OPD confirmed as Stage 1 hero flow. | Founders | — |
| C-4 | ✅ **Resolved (2026-07-04)** — **Drizzle** selected with four guardrails per **ADR 0011** (Accepted). | Engineering | — |
