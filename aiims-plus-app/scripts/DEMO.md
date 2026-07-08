# AIIMS+ — Demo runbook

A tight, repeatable OPD story you can run **live** or narrate over the UI.
Uses the **plain realm (no MFA)** — the hardened MFA realm is for production.

## Before you present (2 minutes)

```bash
cd aiims-plus-app
bash scripts/dev-up.sh      # boots everything, waits for health, prints the link
bash scripts/dev-check.sh   # 10-sec preflight — must be ALL GREEN
```

If anything is red, run `dev-up.sh` again. Open **http://localhost:3001**.

## Option A — narrate over the UI

Log in at http://localhost:3001 as **`doctor.a` / `doctor`** (or `frontdesk.a` /
`frontdesk`, `admin.a` / `admin`). Walk the pages: Patients → new patient →
Appointments → Encounter. Talking points below.

## Option B — run the scripted end-to-end (great as a live proof or a fallback)

```bash
bash scripts/demo-walkthrough.sh
```

Runs the whole golden path in ~5 seconds and prints each step. Re-runnable —
reuses the same hospital, creates a fresh patient/visit each time.

## The story (6 beats, 3 roles — separation of duties)

1. **Admin builds the hospital.** Organisation → facility → department, and puts
   a doctor on staff. _"One platform, multi-tenant: every hospital is fully
   isolated at the database level."_
2. **Front desk registers the patient.** Name, DOB, phone, ABHA. _"Patient
   identifiers — phone, email, ABHA — are encrypted at rest with per-record
   keys. India-first: ABHA and DPDP aligned."_
3. **Front desk books & checks in.** Appointment → check-in issues a queue token
   and opens the clinical encounter. _"Reception books and arrives patients;
   doctors treat — enforced by role, not convention."_
4. **Doctor documents & asks AI for help.** Records vitals, then AI suggests
   ICD-10 codes. _"The AI is operational-only and advisory — it labels every
   output 'AI-generated — verify', redacts PHI before the model, and can never
   diagnose or write to the record. The doctor accepts a code; a human is always
   in the loop."_
5. **Doctor signs.** Explicit attestation; the encounter becomes immutable.
   _"Signing is doctor-only and human — a constitutional guarantee."_
6. **Front desk bills & settles.** Invoice generated from the encounter, paid by
   (mock) UPI. _"Money is exact integer paise, never floats."_

**Close:** _"Every step you just saw is tenant-isolated, permission-checked, and
written to a tamper-evident, hash-chained audit log."_ Then prove it:

```bash
pnpm --filter @aiims/db verify:audit    # re-walks the chain: intact
```

## If something hiccups mid-demo

- Login bounces to "Sign-in failed" → the web server lost its env; run
  `scripts/dev-up.sh` (it reloads env and restarts). Log in with `doctor` (not
  the hardened password).
- A page shows no data → the API is down; `dev-check.sh` will flag `:3000`.
- Fall back to **Option B** — the scripted walkthrough always tells the full
  story even if the UI is being temperamental.
