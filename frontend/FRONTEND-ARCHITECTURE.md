# AIIMS+ — Frontend Architecture (Phase 6)

**Version:** 1.0 · **Owner:** Frontend Lead · **Status:** **Frozen (canonical, approved 2026-07-04)** — offline PHI-on-device remains gated on Security sign-off (§13/§29)
**Dependencies:** `../architecture/ARCHITECTURE-BLUEPRINT.md` (§8), `../api/API-ARCHITECTURE.md`,
`../security/SECURITY-BLUEPRINT.md`, `../backend/BACKEND-ARCHITECTURE.md`, ADR 0008/0010, SDR 0001/0002/0004,
APDR 0003/0004/0005/0006/0007/0008/0009
**Last Updated:** 2026-07-04 · **Review Trigger:** GOVERNANCE.md §6 flaw process; new client platform.

Canonical frontend reference for AIIMS+, covering the **Web Application** and **native-quality Mobile apps
(Android & iOS)**. All clients **consume the frozen API** and honor the frozen Architecture, Database,
Security, and Backend foundations. Frontend decisions are recorded as **FEDRs**. Consistency review is in
§29, freeze report in §30. No implementation code.

**Inherited & non-negotiable:** thin clients — **no business logic duplicated in the client** (Blueprint
§8); OIDC via Keycloak (ADR 0008); **web BFF holds tokens, never the browser** (SDR-0001); **no
unencrypted PHI in client storage** (SDR-0004); consume REST + `/fhir/R4` only via the frozen contracts;
feature flags gate integrations (ADR 0010).

---

## 1. Frontend Philosophy — FEDR-0001/0002

- **Thin, contract-driven clients.** The server decides; the client presents and orchestrates. All types
  and validation come from shared packages (`domain-types`, `api-contracts`) — never re-derived.
- **One product, two runtimes.** Web (browser) and mobile (iOS/Android) share domain types, API client,
  validation, design tokens, and business/UX logic; only the presentation layer is platform-specific.
- **Native-quality mobile**, not a wrapped web view.
- **Clinical UX bar:** fast, legible, dense-where-needed, accessible, and safe (no accidental data actions).
- **Security & privacy first:** minimize PHI on the client; assume devices can be lost/compromised.

## 2. Technology Stacks — FEDR-0001/0002/0003

- **Web (FEDR-0001):** **Next.js (App Router) + React + TypeScript** with a **BFF** layer; Tailwind +
  shadcn/ui (Blueprint §8).
- **Mobile (FEDR-0002):** **React Native + Expo (TypeScript)** for native iOS/Android from one codebase —
  chosen so the frozen TS stack, shared packages, and team skills carry over; delivers native-quality UI
  and access to secure device storage/biometrics.
- **Code sharing (FEDR-0003):** shared monorepo packages — `domain-types`, `api-contracts` (typed client),
  `validation` (Zod), `design-tokens`, and framework-agnostic hooks/logic. **Platform-specific UI**
  (`packages/ui-web` shadcn/ui, `packages/ui-native` RN components) implement the same design system.

**Why React Native over Flutter/native:** Flutter (Dart) would fork the language and forfeit reuse of the
frozen TS contracts/validation; separate native codebases double the work for two founders. RN+Expo keeps
one language, reuses contracts, and still ships native UX. (See FEDR-0002 trade-offs.)

## 3. Design System — FEDR-0004

- **Token-first:** a single source of **design tokens** (color, type scale, spacing, radius, elevation,
  density) drives both web and native, so brand/theme stays consistent cross-platform.
- **Web components:** Tailwind + **shadcn/ui** (Radix primitives — accessible by default).
- **Native components:** an RN component library implementing the same tokens/patterns.
- **Healthcare-tuned:** high legibility, information density modes, clear status/severity color semantics
  (never color-only — paired with text/icon for accessibility), safe destructive-action patterns.

## 4. Component Architecture — FEDR-0004

- **Layered components:** primitives (tokens) → composites (form field, data table, patient card) →
  feature components (encounter note editor) → screens/pages.
- **Presentational vs container:** presentational components are pure; data/logic live in hooks (§9/§10).
- **Shared behavior, platform rendering:** a component's logic/hook is shared; its rendering differs per
  platform. **Accessibility is a component-level requirement**, not an afterthought (§18).

## 5. Application Shell — FEDR-0009

- **Web shell:** authenticated layout (nav, tenant/facility switcher, user menu, notifications) rendered
  via Next.js layouts/Server Components; content area is the routed app.
- **Mobile shell:** tab/stack navigator shell with the same information architecture.
- Shell resolves **tenant + facility + role context** from the session and adapts navigation to
  authorization (§12).

## 6. Web Architecture — FEDR-0001/0007

- **Next.js App Router:** Server Components for the shell and non-PHI/marketing surfaces; the clinical app
  runs as a rich client. **BFF pattern** (Next route handlers) mediates all API calls so the browser never
  holds long-lived tokens (SDR-0001); httpOnly/Secure/SameSite cookie session.
- SSR/streaming for fast first paint of the shell; client hydration for interactivity.
- No PHI persisted in browser storage; sensitive views are auth-gated at the server boundary.

## 7. Mobile Architecture — FEDR-0002/0007/0010

- **React Native + Expo**, TypeScript. Native navigation (Expo Router / React Navigation).
- **Secure token storage** in the OS keystore (iOS Keychain / Android Keystore); **biometric unlock**
  option (Production). PKCE OIDC directly with Keycloak (no BFF on device; §11).
- **Offline-capable** with an **encrypted local store** (§13) — designed-for now, full offline sync phased.
- Push notifications (Production) via Expo/FCM/APNs; deep links honor auth + tenant scope.

## 8. Navigation & Routing — FEDR-0009

- **Web:** Next.js App Router (file-based, nested layouts, server/client boundaries).
- **Mobile:** Expo Router (file-based) / React Navigation — stacks + tabs mirroring web IA.
- **Shared route + permission model:** a declarative map of routes → required capabilities (§12) shared
  across platforms, so navigation and guards stay consistent. Unauthorized routes are hidden and guarded.
- Deep-linking supported on both; all navigations are auth- and tenant-aware.

## 9. State Management — FEDR-0005

- **Server state: TanStack Query** (web + native) — caching, invalidation, retries, optimistic updates,
  background refetch. The API is the source of truth; the cache is derived.
- **Local UI state: Zustand** for the small amount not server-derived (wizard steps, panel toggles).
- **No global mutable store of domain data** — avoids stale/duplicated truth. Forms use RHF (§16).
- Same libraries on both platforms → shared hooks and predictable behavior.

## 10. API Integration Layer — FEDR-0006

- A **typed API client generated from `api-contracts`/OpenAPI** (APDR-0014) — no hand-written request
  types; client and server stay in lockstep.
- **Web** calls go through the **BFF**; **mobile** calls the API directly with a bearer token from secure
  storage. Both attach correlation ids, handle the Problem-Details error model (APDR-0003), send
  `Idempotency-Key` on unsafe writes (APDR-0006), and use cursor pagination (APDR-0005).
- Retries/backoff and 401→refresh handled centrally; 409 surfaces a conflict-resolution UX (§16).

## 11. Authentication Flow — FEDR-0007 (implements SDR-0001, ADR 0008, APDR-0004)

- **Web:** Authorization Code + **PKCE** via the **BFF**; tokens in an httpOnly cookie session; the browser
  never sees long-lived tokens. Silent refresh server-side.
- **Mobile:** native **PKCE** with Keycloak; tokens in **Keychain/Keystore**; refresh-token rotation;
  optional **biometric** gate (Production). Logout clears secure storage + revokes.
- Both send the bearer token per request; tenant/role claims drive context and UI (§12).

## 12. Authorization-aware UI — FEDR-0008 (implements SDR-0002)

- **Capability-driven rendering:** the UI shows/enables actions based on the user's roles/permissions
  (from token claims + a capabilities endpoint). Navigation, buttons, and fields adapt to authorization.
- **Client authz is UX only — never trust it.** The server (PEP/PDP) remains authoritative; the UI merely
  avoids presenting actions that would be denied. Every action is still server-enforced and audited.
- Break-glass/elevated flows (Production) present explicit, audited confirmation UX.

## 13. Offline-first Strategy — FEDR-0010 (security-sensitive; phased)

- **Read resilience (MVP-structural):** TanStack Query persistence caches recently-viewed data for
  transient connectivity gaps; **mobile uses an encrypted local store** (SQLite/MMKV with OS-key
  encryption) — **no plaintext PHI at rest on device** (SDR-0004).
- **Write queueing (phased):** unsafe writes captured offline are queued with their **`Idempotency-Key`**
  and replayed on reconnect; conflicts resolve via **optimistic concurrency → 409** UX (APDR-0006, DDR 0009).
- **Full offline clinical workflows are Production** (device encryption posture, sync engine, conflict
  policy, remote-wipe). **Honest flag:** PHI on device is a real risk surface — the Security phase must
  sign off the device-storage posture before offline PHI is enabled (see §26, Open Questions §29).

## 14. Caching Strategy — FEDR-0005/0010

- **Server-state cache** (TanStack Query): staleness/invalidation tuned per resource; mutations invalidate
  affected queries. **PHI is not cached beyond session** on web; on mobile only in the **encrypted** store.
- **Static assets** via CDN (web); RN bundle/asset caching (mobile).
- Cache keys are **tenant-scoped**; switching tenant/facility clears/derives a fresh cache to prevent
  cross-tenant bleed in the UI.

## 15. Real-time Updates (SSE) — FEDR-0012 (implements APDR-0009)

- Consume **Server-Sent Events** for worklist/notification/operation-completion updates; on receipt,
  **invalidate the relevant TanStack Query keys** so the UI reflects fresh server truth (no client-side
  authoritative merges of PHI).
- Authenticated + tenant-scoped stream; auto-reconnect with backoff; graceful degradation to polling.
- Mobile uses the same SSE/notification model; native push (Production) supplements when backgrounded.

## 16. Forms Architecture — FEDR-0011 (implements APDR-0003, BDR-0009)

- **React Hook Form + shared Zod schemas** (`domain-types`) — the **same schema the API validates with**,
  so client and server never disagree on shape (APDR-0003).
- Client validation is **UX only**; the server remains authoritative (BDR-0009). Show 422 field errors
  from the Problem-Details response inline.
- Clinical forms: autosave-draft where safe, explicit sign/finalize actions (doctor signs — Constitution),
  optimistic concurrency conflict (409) surfaces a clear reconcile flow.

## 17. Error Handling — FEDR-0006

- Central handling of the **Problem-Details** model (APDR-0003): field errors → forms; 401 → refresh/login;
  403 → friendly "not permitted"; 404 → not-found; **409 → conflict reconcile**; 429 → backoff notice;
  5xx/503 → safe retry + correlation id shown for support. **No PHI or internals in error UI.**
- Error boundaries isolate failures per screen; the app never white-screens on one failed query.

## 18. Accessibility — FEDR-0004

- **Target WCAG 2.1 AA.** Radix/shadcn (web) and RN accessibility APIs give semantic roles, focus
  management, keyboard nav (web), and screen-reader support (VoiceOver/TalkBack).
- Color is never the sole signal (status paired with text/icon); sufficient contrast; scalable text
  honoring OS font-size settings. Accessibility checks are part of component tests (§28).
- Clinical safety: clear focus/confirmation on destructive/sign actions.

## 19. Responsive & Adaptive Design — FEDR-0004

- **Web responsive** from clinical workstations (dense, multi-pane) down to tablets; breakpoints via
  Tailwind; density modes for high-information screens.
- **Mobile adaptive** layouts for phone/tablet; orientation-aware. Shared design tokens keep proportion and
  rhythm consistent across form factors.

## 20. Performance Optimization — FEDR-0001/0002

- **Web:** code-splitting/route-level lazy loading, Server Components for the shell, streaming SSR, image
  optimization, prefetch of likely-next data (TanStack Query), bundle budgets in CI.
- **Mobile:** Hermes engine, list virtualization, lazy screens, optimized images, minimal bridge traffic.
- Perf budgets and Core Web Vitals (web) / startup + frame metrics (mobile) tracked in observability (§27).

## 21. Internationalization — FEDR-0004

- **i18n framework** from day one (message catalogs, ICU plurals, date/number/locale formatting) — India
  is multilingual; English first, additional Indian languages added without re-architecture.
- No hard-coded user-facing strings; RTL-ready layout primitives. Locale is a user/tenant preference.

## 22. Theme System — FEDR-0004

- **Token-driven theming**: light/dark and per-tenant brand theming from the same token layer, applied
  consistently on web and native. Density and high-contrast variants supported for clinical settings.

## 23. Shared UI Components — FEDR-0003/0004

- `design-tokens` (shared) + `ui-web` (shadcn/ui) + `ui-native` (RN) implement one design system across
  platforms. Shared **headless hooks/logic** (form field, data table, pagination, patient search) back
  both renderers, so behavior is identical and only pixels differ.

## 24. OPD Hero Flow (Stage-1) — FEDR-0008/0011

Realizes the frozen Stage-1 golden path (Roadmap) as the first end-to-end UI, web + mobile:
**register patient → book appointment → check-in → encounter (document vitals/notes/diagnosis) → place
orders / view results → generate invoice → (mock) share-on-consent via ABDM.** Each step is
authorization-aware (§12), server-validated (§16), audit-generating (server), and demoable with mock
integrations (ADR 0010). This flow is the primary acceptance target for the frontend.

## 25. Feature Flags — FEDR-0006 (implements ADR 0010)

- The client reads flags (per-tenant/user) to toggle mock↔real integrations and dark-launch UI. Flag
  evaluation is server-driven (consistent with backend `FeatureFlagModule`); the client never hard-codes
  environment assumptions. Enables progressive rollout of Production features.

## 26. Frontend Security — FEDR-0013 (implements SDR-0001/0004/0009/0010)

- **Tokens:** web — never in JS-accessible storage (BFF httpOnly cookies); mobile — OS secure storage only.
- **PHI on client:** none unencrypted at rest; web session-only, mobile encrypted store; cleared on
  logout/tenant-switch; screenshot/backgrounding protection + optional biometric lock (mobile, Production).
- **Transport:** TLS only; **certificate pinning** on mobile (Production). Web **CSP**, XSS-safe rendering
  (no `dangerouslySetInnerHTML` with untrusted data), SameSite cookies, CSRF protection on the BFF.
- **Least data:** fetch only what a screen needs; redact in logs (§27). Client authz is UX-only (§12).

## 27. Observability — FEDR-0006 (implements SDR-0010)

- **Correlation ids** propagated from the client on every request → end-to-end tracing with the backend.
- **Error + performance monitoring** (web vitals, mobile startup/crash) via an OTel-compatible RUM tool;
  **no PHI in client telemetry** (SDR-0010). Feature-flag + release tagging for rollout analysis.

## 28. Testing Strategy — FEDR-0014 (detail owned by Testing phase / TDR)

- **Unit/component:** React Testing Library (web) + RN Testing Library, incl. **accessibility assertions**.
- **Contract:** validate the typed client against `api-contracts` (no drift).
- **E2E:** Playwright (web) + Detox/Maestro (mobile) covering the OPD hero flow.
- **Visual/regression** for the design system; **i18n** pseudo-locale checks. Full strategy/coverage gates
  are defined in the Testing phase (TDR); this section fixes the hooks.

## 29. Frontend Consistency Review (vs frozen foundation)

| Frozen source | Frontend position | Consistent? |
|---|---|---|
| Blueprint §8 (Next.js, thin client, BFF, no browser tokens, no PHI in storage) | §1/§6/§26 mirror exactly | ✅ |
| Blueprint "Future: Mobile" | §7 elaborates it as React Native + Expo (an addition, not a change) | ✅ |
| ADR 0008 / SDR-0001 (Keycloak OIDC, BFF) | §11 web BFF + mobile PKCE + secure storage | ✅ |
| SDR-0002 (authz) | §12 capability-driven UI, server-authoritative | ✅ |
| SDR-0004 (no unencrypted PHI at rest) | §13/§14/§26 session-only web, encrypted mobile store | ✅ |
| SDR-0010 (no PHI in logs/telemetry) | §27 redacted RUM | ✅ |
| APDR-0003 (envelope/errors/validation) | §16/§17 Problem-Details + shared Zod | ✅ |
| APDR-0004 (auth flow) | §11 | ✅ |
| APDR-0005 (cursor pagination) | §10 client uses cursors | ✅ |
| APDR-0006 (Idempotency-Key, 409) | §10/§13/§16 | ✅ |
| APDR-0007 (presigned file transfer) | §10 uploads via presigned URLs | ✅ |
| APDR-0009 (SSE) | §15 SSE → cache invalidation | ✅ |
| APDR-0014 (contract-first client) | §10 typed client generated from contracts | ✅ |
| ADR 0010 (integrate progressively) | §25 feature flags; offline/push/biometric phased | ✅ |
| Constitution (doctor signs) | §16 explicit sign/finalize by clinician | ✅ |

**New additions (consistent, not contradictions):** React Native + Expo mobile (elaborating the frozen
"Future: Mobile"), encrypted on-device store, offline write-queueing, i18n framework. None changes a frozen
decision; each fits the frozen API/security model.

**Result: no contradictions, no critical flaws.** One item needs Security-phase sign-off before enabling —
**offline PHI on device (§13)** — flagged, not assumed, and phased to Production.

## 30. Frontend Freeze Report

**Defined & authoritative:**
- [x] Philosophy, stacks (web Next.js, mobile React Native+Expo), code sharing (§1–§2) — FEDR-0001/0002/0003
- [x] Design system, components, shell, theming, shared UI (§3–§5, §22–§23) — FEDR-0004
- [x] Web & mobile architecture, navigation/routing (§6–§8) — FEDR-0001/0002/0009
- [x] State, API integration, auth flow, authz-aware UI (§9–§12) — FEDR-0005/0006/0007/0008
- [x] Offline-first, caching, SSE realtime, forms, errors (§13–§17) — FEDR-0010/0012/0011
- [x] A11y, responsive, performance, i18n (§18–§21) — FEDR-0004
- [x] OPD hero flow, feature flags, security, observability, testing (§24–§28) — FEDR-0013/0014
- [x] Consistency review (§29) — no contradictions

**Deferred (non-blocking):** full offline clinical sync + device-storage security sign-off, native push,
biometric lock, certificate pinning, additional Indian languages, per-tenant theming polish — all
Production, behind flags, no architecture change.

**Freeze status: READY TO FREEZE** on approval, with the single condition that **offline PHI-on-device is
not enabled until the Security phase signs off the device posture** (§13/§29). Safe for AI, Testing, and
Infrastructure phases to build upon.

*End of Frontend Architecture v1.0.*
