# AIIMS+ Security Decision Records (SDR) — Index

**Phase:** 3 (Security Architecture) · **Owner:** Security Architect · **Date:** 2026-07-04
**Relationship:** SDRs harden and make concrete the frozen ADRs/DDRs; they do not contradict them.
**Companion:** `SECURITY-BLUEPRINT.md`.

| SDR | Title | Implements | Status | Confidence | Reversibility |
|-----|-------|-----------|--------|------------|---------------|
| 0001 | Identity & token architecture (Keycloak/OIDC/PKCE/BFF) | ADR 0008 | Accepted | High | Medium |
| 0002 | Authorization: RBAC-now, ABAC-ready, PEP/PDP, break-glass | Blueprint §11 | Accepted | High | Medium |
| 0003 | Tenant isolation defense-in-depth | DDR 0002/0003/0008 | Accepted | High | Very low |
| 0004 | PHI protection & field encryption (**ratifies DDR-0006**) | ADR 0009 / DDR 0006 | Accepted | High | Low |
| 0005 | Key management: KMS CMK hierarchy + envelope + per-tenant CMK | DDR 0006 | Accepted | High | Medium |
| 0006 | Secrets management | Blueprint §20 | Accepted | High | Medium |
| 0007 | Audit integrity & tamper-evidence | DDR 0007 | Accepted | High | Low |
| 0008 | Network & infrastructure security | ADR 0001/0007 | Accepted | High | Medium |
| 0009 | API security controls | Blueprint §13 | Accepted | High | Medium |
| 0010 | Logging/monitoring & PHI redaction | Blueprint §22 | Accepted | High | Medium |
| 0011 | AI security boundary controls | Blueprint §10/§28 | Accepted | High | Low |
| 0012 | Supply chain & secure SDLC | Blueprint §23 | Accepted | High | Medium |
| 0013 | Incident response & breach notification | ADR 0009 | Accepted (timelines legal-deferred) | Med-High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
