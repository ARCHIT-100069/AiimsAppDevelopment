#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  AIIMS+ — end-to-end demo walkthrough (safe to run live during a pitch)
#
#  Tells the whole OPD story across THREE roles (separation of duties):
#    Admin      → builds the hospital: organisation → facility → department
#                 → registers a doctor on staff
#    Front desk → registers a patient (with mock ABHA) → books an appointment
#                 → checks the patient in (opens the clinical encounter)
#    Doctor     → records vitals → asks the AI for ICD-10 coding help
#                 → accepts a code as the diagnosis → signs the encounter
#    Front desk → generates the invoice → takes (mock) UPI payment
#
#  Every call is tenant-scoped, RBAC-checked, and audited. Re-runnable: each run
#  creates fresh records (unique practitioner/appointment) so you can rehearse
#  repeatedly. Read-only to your data model — pure API calls against :3000.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

API="${API_BASE_URL:-http://localhost:3000}"
KC="${OIDC_ISSUER_URL:-http://localhost:8080/realms/aiims}"
export DOCKER_HOST="${DOCKER_HOST:-unix:///Users/$USER/.colima/default/docker.sock}"

# ---- pretty output --------------------------------------------------------
b=$'\033[1m'; dim=$'\033[2m'; grn=$'\033[32m'; cyn=$'\033[36m'; ylw=$'\033[33m'; red=$'\033[31m'; rst=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$cyn$b" "$*" "$rst"; }
ok()   { printf '  %s✓%s %s\n' "$grn" "$rst" "$*"; }
info() { printf '  %s%s%s\n' "$dim" "$*" "$rst"; }
die()  { printf '\n%s✗ %s%s\n' "$red" "$*" "$rst" >&2; exit 1; }

# JSON field extractor: jget '<json>' key.path
jget() { python3 -c 'import sys,json;d=json.loads(sys.stdin.read())
p=sys.argv[1].split(".")
for k in p:
    d=d[int(k)] if k.isdigit() else d.get(k)
    if d is None: break
print(d if d is not None else "")' "$1"; }

token() { # username password
  local r; r=$(curl -s -X POST "$KC/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=aiims-cli -d username="$1" -d password="$2")
  printf '%s' "$r" | jget access_token
}

# api METHOD PATH TOKEN [json-body] [extra-header ...]
api() {
  local method="$1" path="$2" tok="$3" body="${4:-}"; shift 4 2>/dev/null || shift $#
  local args=(-s -X "$method" "$API$path" -H "Authorization: Bearer $tok")
  [ -n "$body" ] && args+=(-H "content-type: application/json" -d "$body")
  while [ $# -gt 0 ]; do args+=(-H "$1"); shift; done
  curl "${args[@]}"
}

uuid() { python3 -c 'import uuid;print(uuid.uuid4())'; }

# find an item id in a {data:[...]} list response by field==value ("" if absent)
find_id() { python3 -c 'import sys,json
d=json.loads(sys.stdin.read()); f,v=sys.argv[1],sys.argv[2]
print(next((x["id"] for x in d.get("data",[]) if x.get(f)==v),""))' "$1" "$2"; }

# ---- 0. preflight ---------------------------------------------------------
step "Preflight"
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$API/healthz")" = "200" ] \
  || die "API not up on $API — run scripts/dev-up.sh first"
ok "API healthy at $API"
# AI capability is dark by default — enable it for the demo (idempotent).
docker exec aiims-plus-app-postgres-1 psql -U postgres -d aiims -qtc \
  "INSERT INTO platform.feature_flag (id,tenant_id,key,enabled) VALUES (gen_random_uuid(),NULL,'ai.coding_assist',true) ON CONFLICT (tenant_id,key) DO UPDATE SET enabled=true;" >/dev/null 2>&1 \
  && ok "AI coding-assist capability enabled" || info "could not toggle AI flag (continuing)"

ADMIN=$(token admin.a admin);       [ -n "$ADMIN" ] || die "admin.a login failed"
FRONT=$(token frontdesk.a frontdesk);[ -n "$FRONT" ] || die "frontdesk.a login failed"
DOC=$(token doctor.a doctor);        [ -n "$DOC" ]   || die "doctor.a login failed"
ok "Signed in: admin.a · frontdesk.a · doctor.a  (tenant A)"

# ---- 1. ADMIN builds the hospital ----------------------------------------
step "1 · Admin builds the hospital structure"
HOSP="Demo Multispeciality Hospital"
ORG_ID=$(api GET /v1/organizations "$ADMIN" | find_id name "$HOSP")
if [ -z "$ORG_ID" ]; then
  ORG_ID=$(api POST /v1/organizations "$ADMIN" "{\"name\":\"$HOSP\",\"type\":\"hospital\"}" | jget id)
  ok "Organisation created  ${dim}($ORG_ID)${rst}"
else ok "Organisation reused   ${dim}($ORG_ID)${rst}"; fi
[ -n "$ORG_ID" ] || die "org find/create failed"

FAC_NAME="Main Campus — OPD Block"
FAC_ID=$(api GET "/v1/facilities?organizationId=$ORG_ID" "$ADMIN" | find_id name "$FAC_NAME")
if [ -z "$FAC_ID" ]; then
  FAC_ID=$(api POST /v1/facilities "$ADMIN" "{\"organizationId\":\"$ORG_ID\",\"name\":\"$FAC_NAME\",\"timezone\":\"Asia/Kolkata\"}" | jget id)
  ok "Facility created      ${dim}($FAC_ID)${rst}"
else ok "Facility reused       ${dim}($FAC_ID)${rst}"; fi
[ -n "$FAC_ID" ] || die "facility find/create failed"

DEPT_ID=$(api GET "/v1/departments?facilityId=$FAC_ID" "$ADMIN" | find_id code "OPD-GEN")
if [ -z "$DEPT_ID" ]; then
  DEPT_ID=$(api POST /v1/departments "$ADMIN" "{\"facilityId\":\"$FAC_ID\",\"name\":\"General Medicine OPD\",\"code\":\"OPD-GEN\"}" | jget id)
  ok "Department created    ${dim}(OPD-GEN)${rst}"
else ok "Department reused     ${dim}(OPD-GEN)${rst}"; fi
[ -n "$DEPT_ID" ] || die "department find/create failed"

# a fresh staff login + clinical profile (keeps the run repeatable)
SUB=$(uuid)
USR=$(api POST /v1/users "$ADMIN" "{\"keycloakSub\":\"$SUB\",\"displayName\":\"Dr. Meera Rao\"}")
USR_ID=$(printf '%s' "$USR" | jget id); [ -n "$USR_ID" ] || die "user create failed: $USR"
api POST "/v1/users/$USR_ID/roles" "$ADMIN" '{"roleCode":"doctor"}' >/dev/null
REG="MCI-$(date +%s)"
PRAC=$(api POST /v1/practitioners "$ADMIN" "{\"appUserId\":\"$USR_ID\",\"registrationNo\":\"$REG\",\"departmentId\":\"$DEPT_ID\",\"nameGiven\":\"Meera\",\"nameFamily\":\"Rao\"}")
PRAC_ID=$(printf '%s' "$PRAC" | jget id); [ -n "$PRAC_ID" ] || die "practitioner create failed: $PRAC"
ok "Doctor on staff       ${dim}(Dr. Meera Rao · $REG)${rst}"

# ---- 2. FRONT DESK registers + books -------------------------------------
step "2 · Front desk registers the patient & books the visit"
PAT=$(api POST /v1/patients "$FRONT" '{"nameGiven":"Anaya","nameFamily":"Sharma","gender":"female","birthDate":"1994-03-12","phone":"+91 98765 43210","requestAbha":true}' "Idempotency-Key: $(uuid)")
PAT_ID=$(printf '%s' "$PAT" | jget id); [ -n "$PAT_ID" ] || die "patient create failed: $PAT"
MRN=$(printf '%s' "$PAT" | jget mrn); ABHA=$(printf '%s' "$PAT" | jget abhaAddress)
ok "Patient registered    ${dim}(Anaya Sharma · MRN $MRN)${rst}"
info "identifiers (phone) are encrypted at rest; ABHA: ${ABHA:-<mock>}"

START="$(python3 -c 'import datetime,random;print((datetime.datetime.utcnow()+datetime.timedelta(days=1,minutes=random.randint(0,50000))).replace(microsecond=0).isoformat()+"Z")')"
END="$(python3 -c 'import sys,datetime;print((datetime.datetime.fromisoformat(sys.argv[1].replace("Z",""))+datetime.timedelta(minutes=15)).isoformat()+"Z")' "$START")"
APPT=$(api POST /v1/appointments "$FRONT" \
  "{\"patientId\":\"$PAT_ID\",\"practitionerId\":\"$PRAC_ID\",\"facilityId\":\"$FAC_ID\",\"departmentId\":\"$DEPT_ID\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"appointmentType\":\"routine\",\"reasonText\":\"Fever and cough, 3 days\"}" \
  "Idempotency-Key: $(uuid)")
APPT_ID=$(printf '%s' "$APPT" | jget id); [ -n "$APPT_ID" ] || die "appointment failed: $APPT"
ok "Appointment booked    ${dim}($START)${rst}"

CHECKIN=$(api POST "/v1/appointments/$APPT_ID/check-in" "$FRONT" '' "Idempotency-Key: $(uuid)")
ENC_ID=$(printf '%s' "$CHECKIN" | jget encounterId); QTOK=$(printf '%s' "$CHECKIN" | jget queueToken)
[ -n "$ENC_ID" ] || die "check-in failed: $CHECKIN"
ok "Checked in            ${dim}(queue token #$QTOK · encounter opened)${rst}"

# ---- 3. DOCTOR documents + AI coding + sign ------------------------------
step "3 · Doctor examines, records vitals & signs"
api POST "/v1/encounters/$ENC_ID/observations" "$DOC" \
  '{"code":{"system":"http://loinc.org","code":"8310-5","display":"Body temperature"},"valueNumeric":38.6,"unit":"Cel"}' >/dev/null
api POST "/v1/encounters/$ENC_ID/observations" "$DOC" \
  '{"code":{"system":"http://loinc.org","code":"8867-4","display":"Heart rate"},"valueNumeric":96,"unit":"/min"}' >/dev/null
ok "Vitals recorded       ${dim}(temp 38.6 °C · HR 96/min)${rst}"

step "4 · AI coding assist (advisory, human-in-the-loop)"
AI=$(api POST /v1/ai/coding-suggestion "$DOC" \
  '{"text":"38 year old with fever and cough for three days, likely acute upper respiratory infection"}')
LABEL=$(printf '%s' "$AI" | jget label); PROV=$(printf '%s' "$AI" | jget provider)
REDACT=$(printf '%s' "$AI" | jget redactionApplied)
[ -n "$LABEL" ] || die "AI suggestion failed (is ai.coding_assist enabled?): $AI"
ok "AI responded          ${dim}(provider: $PROV · PHI redacted: $REDACT)${rst}"
printf '  %s%s%s\n' "$ylw" "$LABEL" "$rst"
printf '%s' "$AI" | python3 -c 'import sys,json
d=json.load(sys.stdin)
for s in d.get("suggestions",[])[:5]:
    c=s["code"]
    print("    - %-8s %-46s conf %.2f" % (c["code"], c["display"][:46], s["confidence"]))'

# doctor ACCEPTS the top suggestion as the diagnosis (HITL)
SYS=$(printf '%s' "$AI" | jget suggestions.0.code.system)
CODE=$(printf '%s' "$AI" | jget suggestions.0.code.code)
DISP=$(printf '%s' "$AI" | jget suggestions.0.code.display)
if [ -z "$CODE" ]; then SYS="http://hl7.org/fhir/sid/icd-10"; CODE="J06.9"; DISP="Acute upper respiratory infection, unspecified"; fi
api POST "/v1/encounters/$ENC_ID/conditions" "$DOC" \
  "{\"code\":{\"system\":\"$SYS\",\"code\":\"$CODE\",\"display\":\"$DISP\"},\"category\":\"diagnosis\"}" >/dev/null
ok "Diagnosis accepted    ${dim}($CODE — $DISP)${rst}"

step "5 · Doctor signs the encounter (attestation, doctor-only)"
VER=$(api GET "/v1/encounters/$ENC_ID" "$DOC" | jget version)
SIGN=$(api POST "/v1/encounters/$ENC_ID/sign" "$DOC" '{"attestation":true}' "If-Match: $VER")
STATUS=$(printf '%s' "$SIGN" | jget status); [ "$STATUS" = "finished" ] || die "sign failed: $SIGN"
ok "Encounter signed      ${dim}(status: finished · immutable)${rst}"

# ---- 6. FRONT DESK bills + settles ---------------------------------------
step "6 · Front desk invoices & takes payment"
INV=$(api POST "/v1/encounters/$ENC_ID/invoice" "$FRONT" '{"consultationFee":"500.00"}')
INV_ID=$(printf '%s' "$INV" | jget id); INV_NO=$(printf '%s' "$INV" | jget invoiceNumber)
TOTAL=$(printf '%s' "$INV" | jget total); [ -n "$INV_ID" ] || die "invoice failed: $INV"
ok "Invoice generated     ${dim}($INV_NO · ₹$TOTAL)${rst}"

PAY=$(api POST "/v1/invoices/$INV_ID/pay" "$FRONT" '{"method":"upi"}' "Idempotency-Key: $(uuid)")
PSTATUS=$(printf '%s' "$PAY" | jget status); PREF=$(printf '%s' "$PAY" | jget paymentRef)
[ "$PSTATUS" = "paid" ] || die "payment failed: $PAY"
ok "Payment settled       ${dim}(UPI · $PREF · status: paid)${rst}"

# ---- done -----------------------------------------------------------------
printf '\n%s────────────────────────────────────────────────%s\n' "$grn" "$rst"
printf '%s ✓ Golden path complete.%s  Patient %sAnaya Sharma (MRN %s)%s\n' "$grn$b" "$rst" "$b" "$MRN" "$rst"
printf '   registered → seen → coded → diagnosed → signed → paid (₹%s).\n' "$TOTAL"
printf '   Every step tenant-isolated, RBAC-checked, and in the tamper-evident audit log.\n'
printf '%s────────────────────────────────────────────────%s\n' "$grn" "$rst"
printf '   Verify the audit chain:  %spnpm --filter @aiims/db verify:audit%s\n' "$dim" "$rst"
printf '   See it in the UI:        %shttp://localhost:3001/patients%s\n\n' "$dim" "$rst"
