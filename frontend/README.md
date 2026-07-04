# Frontend — Phase 6 Documentation

**Status:** Complete — ready to freeze (2026-07-04)
**Record type:** FEDR — Frontend Engineering Decision Record
**Owner:** Frontend Lead
**Depends on:** architecture/, api/, security/, backend/, database/ (all frozen)
**Last Updated:** 2026-07-04
**Review Trigger:** GOVERNANCE.md §6 flaw process; new client platform

Covers the **Web application (Next.js)** and **native-quality Mobile apps (React Native + Expo, Android & iOS)**.

Contents:
- `FRONTEND-ARCHITECTURE.md` — canonical frontend reference (30 sections + consistency review + freeze report).
- `0000-index.md` — FEDR index.
- `FEDR-0001 … FEDR-0014` — frontend engineering decision records.

Consistency review vs the frozen Architecture, Database, Security, Backend, and API phases found **no
contradictions**. One condition on freeze: **offline PHI-on-device (FEDR-0010) is not enabled until the
Security phase signs off the device-storage posture.**

- Template & lifecycle: `/GOVERNANCE.md`
- Master index: `/DECISION-REGISTRY.md`
- Frozen upstream (do not redesign): `/architecture/`, `/database/`, `/security/`, `/backend/`, `/api/`
