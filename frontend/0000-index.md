# AIIMS+ Frontend Engineering Decision Records (FEDR) — Index

**Phase:** 6 (Frontend Architecture) · **Owner:** Frontend Lead · **Date:** 2026-07-04
**Relationship:** FEDRs define web + native-mobile clients over the frozen API/Security/Backend phases;
they contradict none. **Companion:** `FRONTEND-ARCHITECTURE.md`.

| FEDR | Title | Implements | Status | Confidence | Reversibility |
|------|-------|-----------|--------|------------|---------------|
| 0001 | Web stack: Next.js + React + TS + Tailwind/shadcn + BFF | Blueprint §8 | Accepted | High | Medium |
| 0002 | Mobile stack: React Native + Expo (native iOS/Android) | Blueprint "Future: Mobile" | Accepted | Med-High | Medium |
| 0003 | Cross-platform code sharing (shared packages + platform UI) | Backend `packages/*` | Accepted | High | Medium |
| 0004 | Design system, tokens, theming, a11y, i18n | Blueprint §8 | Accepted | High | Medium |
| 0005 | State management: TanStack Query + Zustand | Blueprint §8 | Accepted | High | Medium |
| 0006 | API integration: typed client from contracts + flags + obs | APDR 0003/0014, SDR 0010 | Accepted | High | Medium |
| 0007 | Auth flow: web BFF cookie; mobile PKCE + secure storage | SDR 0001, ADR 0008, APDR 0004 | Accepted | High | Low |
| 0008 | Authorization-aware UI (server-authoritative) | SDR 0002 | Accepted | High | Medium |
| 0009 | Navigation & routing (shared route+permission model) | API §7 | Accepted | High | Medium |
| 0010 | Offline-first & encrypted client caching (phased) | SDR 0004, APDR 0006 | Accepted (Security sign-off for offline PHI) | Med | Medium |
| 0011 | Forms & validation: RHF + shared Zod | APDR 0003, BDR 0009 | Accepted | High | Medium |
| 0012 | Realtime via SSE → cache invalidation | APDR 0009 | Accepted | High | Medium |
| 0013 | Frontend security & PHI-on-client policy | SDR 0001/0004/0009/0010 | Accepted | High | Low |
| 0014 | Frontend testing strategy (hooks; detail in TDR) | Backend §18 | Accepted | High | Medium |

Template: Context · Decision · Alternatives · Trade-offs · Consequences · Dependencies · Confidence ·
Reversibility · Phase Classification · Related Documents · Review Trigger (GOVERNANCE §3).
