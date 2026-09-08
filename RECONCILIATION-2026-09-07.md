# AIIMS+ — Stack Reconciliation vs FOUNDER-A-CONTEXT-PACK.md

**Version:** 1.0 · **Owner:** Engineering (this Cowork) · **Status:** Draft — awaiting founder review
**Dependencies:** `GOVERNANCE.md`, `DECISION-REGISTRY.md`, `Open-Issues-and-Assumptions.md`, `adr/`
**Last Updated:** 2026-09-07
**Review Trigger:** founder decision on each item below; supersede on approval.

No feature code was written to produce this. It's a read of what's actually in the repo (current
Postgres + Keycloak(`aiims`) + Redis + MinIO + field-level encryption stack, API `:3000`, web `:3001`,
`dev-up.sh`/`dev-check.sh`) against the governing docs, filed as findings for your call.

---

## 0. Load-bearing finding, before anything else

**`FOUNDER-A-CONTEXT-PACK.md` is not in this repository.** I searched the full tree (including the
old `aiims-plus/` reference copy) — it isn't there. This isn't new: it's open issue **D-1** in
`Open-Issues-and-Assumptions.md`, logged 2026-07-03, still unresolved as of today. `POST-PITCH.md` and
anything called `DECISIONS.md` are also absent — repo-wide search, zero hits. There's no file named
`Vol VI` anywhere either.

Practically: I cannot check your "Section 5," "Section 7," or "Vol VI Ch. 7" citations against the
source. What follows is checked against what **is** in the repo — `ADR-0008`, `DECISION-REGISTRY.md`,
`ARCHITECTURE-BLUEPRINT.md`, the Keycloak realm files, the DB seed/role enum, and the actual UI code —
and in two places (§1, §5) that repo state directly contradicts the premise of your ask. I'm flagging
those contradictions rather than quietly resolving them in one direction, because they change what
"reconcile" even means here — until the Context Pack itself is re-uploaded, D-1 stays the actual root
cause and everything downstream of it (including this document) is provisional.

---

## 1. Auth: Keycloak vs in-monolith JWT

**Correction to the premise:** this is not an undocumented deviation. `ADR-0008 — "Identity: buy
(Keycloak), don't build"` exists, and per `DECISION-REGISTRY.md` line 51 its status is **Frozen, v1.0**
(the ADR file's own header still says "Proposed," which is a stale-header bug worth a one-line fix, but
the registry — the authoritative index per `GOVERNANCE.md` §1 — and `ARCHITECTURE-BLUEPRINT.md`, which
cites Keycloak as the OIDC provider in six separate places, both treat it as adopted). `adr/0000-index.md`
records it as **"ratified by founders 2026-07-04."** The old `aiims-plus/` skeleton (Stage 0, pre-dating
this rebuild) already used a dev-OIDC guard, not JWT+argon2. There is no argon2 anywhere in this repo's
history, hardened or otherwise.

So the actual question isn't "should we log this deviation" — it's "does your Context Pack really say
Section 5 requires in-monolith JWT+argon2, and if so, was ADR-0008 ratified *without* reconciling against
it, or does the Context Pack predate/postdate ADR-0008?" That's unanswerable until D-1 closes. Given that,
here's the both-ways case you asked for, decided on its merits:

**(a) Keep Keycloak**
- RBAC/session/token lifecycle, MFA, SSO federation, account recovery — a large security-critical surface
  a two-person founding team doesn't have to build or own (ADR-0008's own stated rationale).
- Self-hosted in-region (`ap-south-1`) — no data-residency conflict, no per-MAU cost as tenants grow.
- `ARCHITECTURE-BLUEPRINT.md` already threads Keycloak through the OIDC seam, the BFF pattern on web,
  and the AuthModule/AuthzModule split (RBAC still lives in-app either way — that split doesn't change
  under either option).
- Reversing it now means unwinding a ratified, Frozen ADR plus the realm files, the web OIDC callback
  route, the BFF session handling, and the seed data — all built against it already.

**(b) Revert to in-monolith JWT + argon2 + NestJS RBAC guards**
- One fewer service to run/patch/HA in the demo and in production — Keycloak is real operational surface
  for a two-founder team, which is the exact cost ADR-0008 weighed and accepted.
- Matches Founder B's assumed stack if their build has already diverged around it — avoiding a two-way
  merge conflict has real value independent of which stack is objectively "better."
- Removes the OIDC/BFF token-handling code entirely — genuinely less code, at the cost of taking on
  session security, MFA, and account recovery as code you now own and must get right for healthcare data.

**Recommendation: keep Keycloak.** ADR-0008 is Frozen; `GOVERNANCE.md` §6 says a Frozen decision changes
only for a critical flaw in security, correctness, scalability, compliance, or business viability —
"Founder B assumed a different stack" isn't one of those five, it's a sync problem. Reverting now also
discards real, already-built code (web OIDC/BFF flow, realm provisioning, `dev-up.sh` sequencing) to
match an unverified premise. If the Context Pack, once re-uploaded, turns out to mandate JWT+argon2
explicitly and post-dates ADR-0008, that's a **new** critical-flaw case ("correctness" — building against
a superseded decision) and reopens this properly through §6, not through this reconciliation.

**Draft registry line** (for `DECISION-REGISTRY.md` / whatever the other founder's Claude reads), to sync
across builds now rather than waiting on the Context Pack:

```
| ADR-0008-SYNC | Identity: Keycloak (buy, not build) — reaffirmed 2026-09-07 pending FOUNDER-A-CONTEXT-PACK.md
  re-upload (open issue D-1). What: Keycloak stays the identity provider; RBAC stays in-app (unchanged).
  Why: ADR-0008 is Frozen v1.0, ratified by both founders 2026-07-04 per adr/0000-index.md; no critical
  flaw (GOVERNANCE §6) has been raised against it. Alternatives: in-monolith JWT+argon2 (rejected 2026-07-04,
  ADR-0008 Context) — would require a §6 flaw finding to reopen, not a founder-preference revert. |
  Frozen | 1.0 | Owner: both founders | Review trigger: Context Pack re-upload + reconciliation (D-1) |
```

**Until D-1 closes, the two founders' builds can diverge on this exact axis without either side knowing
it — one Claude reading a Context Pack that says JWT, the other reading a Frozen ADR that says Keycloak,
both "correctly" following their source.** That's the actual risk here, independent of which option is
right.

---

## 2. Credential ambiguity — root cause found, fix drafted (not applied)

The landmine is real but the mechanism is simpler than "which compose file was last up": **only one
realm is ever wired in.** `docker-compose.yml` mounts exactly one import path:

```yaml
volumes:
  - ./docker/keycloak:/opt/keycloak/data/import:ro
```

`docker/keycloak-hardened/realm-aiims.json` (the `DevDoctor#2026`-style realm) is **not referenced by
docker-compose.yml or by any script in `scripts/`** — I grepped the whole tree. It's dead config: it can
only become "live" if someone manually repoints that volume or runs Keycloak outside `docker compose up`.
`dev-check.sh` accepting both passwords is defensive code for a scenario the current compose setup can't
actually produce today — but it's still a landmine, because it silently hides the day someone *does* wire
the hardened realm in (e.g. to test the harder-password path before a real deploy) and nobody updates
`dev-check.sh` to notice which realm is actually live.

**Canonical realm:** `docker/keycloak/realm-aiims.json` (the one docker-compose.yml actually mounts).
**Canonical credentials:** `doctor.a/doctor`, `doctor.b/doctor`, `admin.a/admin`, `admin.c/admin`,
`frontdesk.a/frontdesk`, `platform.admin/platform`, plus `anaya/patient` (provisioned separately by
`scripts/setup_patient_portal.py`, not in the realm JSON).

**Recommendation:** rename `docker/keycloak-hardened/` → `docker/keycloak-hardened.unused/` (or delete
it) so nothing can accidentally get wired in without a deliberate act, and rewrite `dev-check.sh` to
assert identity, not just liveness. Draft below — **not applied**, for your review:

```bash
# password sanity: assert the CANONICAL dev realm is live — fail loudly on anything else.
if curl -s --max-time 3 -X POST "http://localhost:8080/realms/aiims/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=aiims-cli -d username=doctor.a -d password=doctor \
    | grep -q access_token; then
  printf '\033[32m✓ %-24s doctor.a/doctor (canonical realm)\033[0m\n' "Login credentials"
else
  printf '\033[31m✗ %-24s canonical dev realm (docker/keycloak/) is NOT live.\033[0m\n' "Login credentials"
  printf '\033[31m  A different realm/password set is loaded (e.g. keycloak-hardened) —\033[0m\n'
  printf '\033[31m  DO NOT demo. Run: docker compose down -v && ./scripts/dev-up.sh\033[0m\n'
  fail=1
fi
```

This removes the `elif DevDoctor#2026 …` branch entirely — the whole point being that "the other
password also works" is no longer a pass condition, it's the specific failure this exists to catch.

---

## 3. Role coverage vs five-role scope

**LAB_TECH does not exist** — confirmed in all three places a role would have to be defined:
- Keycloak realm roles (both `docker/keycloak/realm-aiims.json` and the unused hardened copy): only
  `platform_admin` is a declared realm role. `doctor`/`admin`/`frontdesk` aren't Keycloak roles at all —
  role assignment lives in the app DB (consistent with ADR-0008: "RBAC/authorization stays in the
  application").
- App role enum, `packages/domain-types/src/index.ts:66`: `ROLE_CODES = ["admin", "doctor", "nurse",
  "front_desk"]`, plus `PATIENT_ROLE = "patient"` handled separately.
- DB seed, `packages/db/src/seed.ts:34`: `ROLES = ["admin", "doctor", "nurse", "front_desk"]`.

So this is a **confirmed scope gap** — no lab role anywhere, and it does block "lab uploads report →
visible to doctor + patient" as a demo beat today.

**Second finding, worth flagging on its own:** the frozen role set is `{patient, doctor, nurse,
front_desk, admin}` — five roles, but the fifth clinical role is **nurse**, not **lab_tech**. Your ask
names `RECEPTIONIST` (= `front_desk`, just a naming difference) and `LAB_TECH`, with no mention of nurse.
If Section 7 of the Context Pack really specifies `LAB_TECH` as the fifth role, then the current frozen
set doesn't just have a gap — it has the **wrong** fifth role, which is a bigger question than "add a
role" (does nurse get demoted to a future-phase role, coexist as a sixth, or was nurse always the
mistake?). That's a founder call, not an engineering one — I'm not resolving it here.

**To add `LAB_TECH`** (spec only, not implemented — for your approval):
1. `packages/domain-types/src/index.ts` — extend `ROLE_CODES` to include `"lab_tech"` (or whatever code
   you settle on after the nurse question above is resolved).
2. `packages/db/src/seed.ts` — add a `lab_tech` demo user + seed row (needs a `keycloakSub`, so step 3
   first).
3. `docker/keycloak/realm-aiims.json` — add a `labtech.a` user (mirroring `frontdesk.a`'s shape) with a
   dev password following the canonical set's convention (§2).
4. `packages/authz/src/index.ts` — decide whether lab techs belong in `CLINICAL_ROLES` (currently
   `["doctor", "nurse"]`) — this gates what the authz layer treats as clinical-data-adjacent, so it
   determines what a lab tech can see, not just that they can log in.
5. `apps/web/app/lib/roles.ts` + `oidc.ts` `STAFF_ROLES` — routing (`/lab`?) and display label.
6. New DDR/ADR entry if this is treated as a change to the Frozen role model (`DATABASE-ARCHITECTURE.md`
   references `ROLE_CODES`) rather than a pure additive extension — worth a governance call, not just a
   code change, given §1's precedent of Frozen meaning immutable-except-via-flaw-process.

---

## 4. Security hardening checklist — before any non-local deploy

One more citation I can't verify: **"Constitution #6/#7"** and **"Vol VI Ch. 7"** don't resolve to
anything in this repo under that numbering. What I *can* find and cite:

- `README.md` "Project guardrails (non-negotiable — Constitution, Master Ch. 19)" and the matching block
  in `adr/0000-index.md` ("Constitutional guardrails, from Master Ch. 19") — both give the same three
  items: no clinical AI/diagnosis/treatment recommendations; security/privacy/audit are mandatory
  platform capabilities; AI is operations-only.
- `Open-Issues-and-Assumptions.md` issue **I-1** already flags that the Constitution's chapter number is
  itself ambiguous ("Product Bible Vol I, Ch. 20" in project instructions vs "Chapter 19" in the actual
  Master Document — Ch. 20 is the Founder's Manifesto, a different document).
- No "Vol VI" file exists anywhere in the tree.

I've written the checklist against the three guardrails above (Ch. 19, however it's eventually numbered)
since those are the only ones I can actually point to in this repo. Add `#6/#7` and Vol VI Ch. 7 items
once the source documents are available — flagging that gap rather than guessing at unverified clause
numbers.

**Before any non-local deploy:**
- [ ] Rotate every demo credential: `doctor.a/doctor`, `admin.a/admin`, `frontdesk.a/frontdesk`,
      `platform.admin/platform`, `anaya/patient`, and the Keycloak bootstrap admin (`admin/admin`,
      `docker-compose.yml:44-45`).
- [ ] Lock the Keycloak admin console — it's open on `:8080/admin` with `admin/admin` and no network
      restriction in the current compose setup; needs to sit behind a VPN/allowlist or a non-default
      bootstrap credential before anything routable.
- [ ] Confirm no secret in `.env` is committed — check `.gitignore` covers `.env` and `apps/web/.env.local`
      (both currently exist as real files on disk with live values: `AIIMS_FIELD_MASTER_KEY`,
      `AIIMS_BLIND_INDEX_KEY`, `SESSION_SECRET`, `AIIMS_APP_PASSWORD`, etc.) and that `git log` has never
      picked them up.
- [ ] Confirm audit logging actually fires on patient-data access — `ADR-0005` ("append-only,
      tamper-evident event log") is Frozen; verify the running system, not just the ADR, before any
      external demo touches real-shaped PHI.
- [ ] MinIO root credentials (`minioadmin`/... — `docker-compose.yml:63-64`) rotate alongside the rest;
      same laptop-local exposure as the Keycloak bootstrap admin.
- [ ] Re-run this checklist against the actual Constitution clause numbers once Vol VI / the Context Pack
      is available — items 6/7 may add requirements not captured above.

---

## 5. Scope + naming

**`/emergency` is not parked — it's built.** `POST-PITCH.md` doesn't exist (repo-wide search, zero hits),
so I can't confirm anything was ever parked there. What I found instead: `apps/web/app/portal/portal-app.tsx`
has a live `"emergency"` tab (`{ key: "emergency", label: "Emergency", group: "More" }`, rendered at
line 249, with its own "In an emergency" panel at line 1291) in the patient portal today. This directly
contradicts the "out of scope" assumption — either it shipped without anyone updating the scope doc, or
the scope doc it's tracked in isn't `POST-PITCH.md` and I'm looking in the wrong place. Either way, this
needs a founder call: keep it in-scope and demo it, feature-flag it off, or actually remove it — not
silently leave it live while treating it as parked.

**Naming — `aiims` is hardwired** in: the Postgres DB name and all three DB role usernames
(`aiims_app`, `aiims_migrator`, `aiims_readonly`), the Keycloak realm (`realms/aiims`), the OIDC audience
(`aiims-api`) and web client id (`aiims-web`), the S3/MinIO bucket (`aiims-clinical`), the root
`package.json` name (`aiims-plus`), and the Docker container name prefixes (e.g.
`aiims-plus-app-postgres-1`, visible in `dev-up.sh`'s `docker exec` call). That's DB rename + migration,
Keycloak realm export/reimport, OIDC client reconfiguration on both API and web, object-storage bucket
migration, and a package/workspace rename — a real, multi-hour mechanical task, not a find-and-replace,
if the product name changes. Flagging the cost now so it's a known trade rather than a surprise later;
not scoping the actual rename since that's feature work and you said hold off.

---

## Summary of asks

1. **§1** — confirm "keep Keycloak" and let me log the sync line into `DECISION-REGISTRY.md`, or tell me
   the Context Pack (once re-uploaded) actually overrides ADR-0008 and this needs a real §6 flaw record.
2. **§2** — approve the `dev-check.sh` rewrite and the hardened-realm-directory rename/removal.
3. **§3** — resolve nurse-vs-lab_tech before I touch the role enum; then I'll implement the 6-step plan.
4. **§4** — no action needed now; checklist is written down for the pre-deploy gate.
5. **§5** — decide `/emergency`'s actual status; rename cost is filed for whenever a name change is live.

And underneath all five: **re-upload `FOUNDER-A-CONTEXT-PACK.md`** (D-1) — it's the one input that would
let me check your Section 5/7 citations directly instead of reasoning from what's downstream of it.
