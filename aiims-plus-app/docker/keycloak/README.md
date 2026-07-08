# Keycloak realm — `realm-aiims.json` (SDR-0001)

Imported at boot via `start-dev --import-realm`. Verified to import cleanly on
Keycloak 26.4.

## Authentication hardening (Stage 9)

- **MFA / TOTP.** `otpPolicy*` defines standard TOTP (SHA-1, 6 digits, 30 s).
  `CONFIGURE_TOTP` is a realm **default required action** (`defaultAction: true`),
  so every **new** user must enrol an authenticator on first interactive
  (browser / Authorization-Code + PKCE) login. Enrolment then makes the default
  browser flow's _Conditional OTP_ step demand a code on every subsequent login.
- **Brute-force protection.** `bruteForceProtected` with a 5-failure factor and
  escalating lockout wait.
- **Password policy.** length ≥ 12, upper + lower + digit + special, not equal to
  the username, 3-password history, 90-day expiry. Enforced on every password
  change; **also validated against imported credentials** — hence the dev seed
  passwords below are policy-compliant.

## Why the pre-seeded dev users don't carry `CONFIGURE_TOTP`

Keycloak's **direct-grant** flow (the `aiims-cli` public client, used for LOCAL
DEV token curls and scripted checks) rejects any account with a **pending
required action** — `invalid_grant: "Account is not fully set up"`. Pinning
`CONFIGURE_TOTP` on the seeded users would therefore break the documented dev
login and token-based testing.

The seeded users are left without pending actions so the dev CLI keeps working;
MFA enrolment is instead forced for **new** users via the realm default action
(above), which only runs in the **browser** flow — exactly the path real human
operators use. The dev CLI direct-grant path is local-only and never exposed in
production (SDR-0001 mandates PKCE for real clients).

### Enforcing MFA on the seeded / all existing accounts (production)

If a deployment reuses these accounts and wants MFA on them too, add the action
per user (one admin toggle, kept out of the dev realm):

```bash
# add CONFIGURE_TOTP to an existing user; browser login will then force enrolment
kcadm.sh update users/<id> -r aiims -s 'requiredActions=["CONFIGURE_TOTP"]'
```

Or set the browser flow's OTP execution to **REQUIRED**. Neither affects the
direct-grant flow.

## Dev credentials (synthetic — LOCAL DEV ONLY)

| username         | password            | tenant           |
| ---------------- | ------------------- | ---------------- |
| `doctor.a`       | `DevDoctor#2026`    | A                |
| `admin.a`        | `DevAdmin#2026`     | A                |
| `frontdesk.a`    | `DevFrontdesk#2026` | A                |
| `doctor.b`       | `DevDoctorB#2026`   | B                |
| `admin.c`        | `DevAdminC#2026`    | C                |
| `platform.admin` | `DevPlatform#2026`  | (platform_admin) |

These are throwaway local-dev credentials for a synthetic realm. Real
deployments provision their own IdP users; no production secret lives here.
