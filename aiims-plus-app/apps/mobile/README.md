# @aiims/mobile — React Native + Expo (scaffold)

**Status:** directory scaffold only (Stage 0). Per `IMPLEMENTATION-MASTER-PLAN.md` §4, the mobile
app is _scaffolded lazily at the frontend build-out_ — Expo/React Native dependencies are added
then, not now, to keep Stage 0 installs lean and reproducible.

When the mobile stage starts (FEDR-0002/0003/0007/0010):

- Expo (TypeScript) app consuming `@aiims/api-contracts` (typed client), `@aiims/domain-types`
  (shared Zod validation), and `@aiims/ui-native` + `@aiims/design-tokens`.
- Native **PKCE** with Keycloak; tokens in **Keychain/Keystore** only (FEDR-0007).
- **No plaintext PHI at rest**; the encrypted offline store is gated on Security sign-off
  (FEDR-0010 — tracked open item).
- CI via **EAS Build** (IDR-0011 §27).
