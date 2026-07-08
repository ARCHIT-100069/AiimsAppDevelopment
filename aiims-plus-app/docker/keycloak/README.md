# Keycloak realms (SDR-0001)

There are **two** realm definitions. `docker-compose` mounts this directory
(`docker/keycloak/`) as Keycloak's import folder, so **only the plain demo realm
here is imported by default**. The hardened production realm lives outside the
import folder so it is never auto-loaded.

| File                                        | Realm                            | Use                                                                                          |
| ------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `docker/keycloak/realm-aiims.json`          | plain — **imported by default**  | Demos / local dev. Simple passwords, **no MFA**, no password policy.                         |
| `docker/keycloak-hardened/realm-aiims.json` | hardened — **not** auto-imported | Production. TOTP MFA (forced for new users), brute-force protection, strong password policy. |

Verified: both import cleanly on Keycloak 26.4; the plain realm boots with no MFA
and `doctor.a` / `doctor` logs in.

## Demo credentials (plain realm — LOCAL DEV ONLY)

| username         | password    | tenant           |
| ---------------- | ----------- | ---------------- |
| `doctor.a`       | `doctor`    | A                |
| `admin.a`        | `admin`     | A                |
| `frontdesk.a`    | `frontdesk` | A                |
| `doctor.b`       | `doctor`    | B                |
| `admin.c`        | `admin`     | C                |
| `platform.admin` | `platform`  | (platform_admin) |

Synthetic throwaway accounts. No production secret lives here.

## Switching to the hardened (MFA) realm for production

Point Keycloak's import at the hardened folder instead — one line in
`docker-compose.yml`:

```yaml
volumes:
  - ./docker/keycloak-hardened:/opt/keycloak/data/import:ro
```

Then recreate Keycloak so the realm re-imports:

```bash
docker compose down -v   # -v wipes the Keycloak DB so the realm re-imports
docker compose up -d
```

The hardened realm then applies:

- **TOTP MFA** — `CONFIGURE_TOTP` is a realm **default required action**, so every
  **new** user must enrol an authenticator on first interactive (browser /
  Authorization-Code + PKCE) login; the Conditional-OTP step then demands a code
  each login.
- **Brute-force protection** (5-failure lockout) and a **strong password policy**
  (len ≥ 12, upper/lower/digit/special, notUsername, history 3, 90-day expiry).
  Keycloak validates imported credentials against the policy, so the hardened
  realm ships policy-compliant passwords (e.g. `doctor.a` / `DevDoctor#2026`).

### Note on the dev direct-grant client

The hardened realm deliberately does **not** pin `CONFIGURE_TOTP` on the
pre-seeded users: Keycloak's direct-grant flow (`aiims-cli`) rejects any account
with a pending required action (`"Account is not fully set up"`), which would
break scripted/dev logins. MFA is forced for **new** users via the default
action (browser flow only). To force it on an existing account in production, add
the action per user (`kcadm.sh update users/<id> -s 'requiredActions=["CONFIGURE_TOTP"]'`)
or set the browser flow's OTP execution to REQUIRED.
