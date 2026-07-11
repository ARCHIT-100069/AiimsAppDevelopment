#!/usr/bin/env bash
# Give the stable demo patient (Anaya, portal user) a real clinical history via
# the API, so the patient portal shows appointments, a diagnosis, and a paid
# invoice. Idempotent: skips if she already has an appointment. Reuses the same
# audited staff endpoints the walkthrough uses.
set -uo pipefail
API="${API_BASE_URL:-http://localhost:3000}"
KC="${OIDC_ISSUER_URL:-http://localhost:8080/realms/aiims}"
PATIENT_ID="0197a000-0000-7000-8000-0000000000c1"   # SEED.demoPatientA

jget() { python3 -c 'import sys,json
d=json.loads(sys.stdin.read())
for k in sys.argv[1].split("."): d=d[int(k)] if k.isdigit() else d.get(k)
print(d if d is not None else "")' "$1"; }
tok() { curl -s -X POST "$KC/protocol/openid-connect/token" -d grant_type=password -d client_id=aiims-cli -d username="$1" -d password="$2" | jget access_token; }
api() { local m="$1" p="$2" t="$3" b="${4:-}"; shift 4 2>/dev/null || shift $#
  local a=(-s -X "$m" "$API$p" -H "Authorization: Bearer $t"); [ -n "$b" ] && a+=(-H "content-type: application/json" -d "$b")
  while [ $# -gt 0 ]; do a+=(-H "$1"); shift; done; curl "${a[@]}"; }
uuid() { python3 -c 'import uuid;print(uuid.uuid4())'; }
find_id() { python3 -c 'import sys,json;d=json.loads(sys.stdin.read());f,v=sys.argv[1],sys.argv[2];print(next((x["id"] for x in d.get("data",[]) if x.get(f)==v),""))' "$1" "$2"; }

ADMIN=$(tok admin.a admin); FRONT=$(tok frontdesk.a frontdesk); DOC=$(tok doctor.a doctor)
[ -n "$ADMIN$FRONT$DOC" ] || { echo "login failed"; exit 1; }

# idempotency: already has an appointment?
existing=$(api GET "/v1/appointments?patientId=$PATIENT_ID" "$FRONT" | jget data.0.id)
[ -n "$existing" ] && { echo "portal history already present — skipping"; exit 0; }

HOSP="Demo Multispeciality Hospital"
ORG=$(api GET /v1/organizations "$ADMIN" | find_id name "$HOSP")
[ -n "$ORG" ] || ORG=$(api POST /v1/organizations "$ADMIN" "{\"name\":\"$HOSP\",\"type\":\"hospital\"}" | jget id)
FAC=$(api GET "/v1/facilities?organizationId=$ORG" "$ADMIN" | find_id name "Main Campus — OPD Block")
[ -n "$FAC" ] || FAC=$(api POST /v1/facilities "$ADMIN" "{\"organizationId\":\"$ORG\",\"name\":\"Main Campus — OPD Block\",\"timezone\":\"Asia/Kolkata\"}" | jget id)
DEPT=$(api GET "/v1/departments?facilityId=$FAC" "$ADMIN" | find_id code "OPD-GEN")
[ -n "$DEPT" ] || DEPT=$(api POST /v1/departments "$ADMIN" "{\"facilityId\":\"$FAC\",\"name\":\"General Medicine OPD\",\"code\":\"OPD-GEN\"}" | jget id)
SUB=$(uuid); USR=$(api POST /v1/users "$ADMIN" "{\"keycloakSub\":\"$SUB\",\"displayName\":\"Dr. Meera Rao\"}" | jget id)
api POST "/v1/users/$USR/roles" "$ADMIN" '{"roleCode":"doctor"}' >/dev/null
PRAC=$(api POST /v1/practitioners "$ADMIN" "{\"appUserId\":\"$USR\",\"registrationNo\":\"MCI-$(date +%s)\",\"departmentId\":\"$DEPT\",\"nameGiven\":\"Meera\",\"nameFamily\":\"Rao\"}" | jget id)

# Availability template so patients see real bookable slots (Mon–Sat 09:00–13:00, 15-min).
for dow in 1 2 3 4 5 6; do
  api POST /v1/practitioner-availability "$ADMIN" "{\"practitionerId\":\"$PRAC\",\"facilityId\":\"$FAC\",\"dayOfWeek\":$dow,\"startTime\":\"09:00\",\"endTime\":\"13:00\",\"slotMinutes\":15}" >/dev/null
done

START="$(python3 -c 'import datetime;print((datetime.datetime.utcnow()+datetime.timedelta(days=3)).replace(microsecond=0).isoformat()+"Z")')"
END="$(python3 -c 'import sys,datetime;print((datetime.datetime.fromisoformat(sys.argv[1].replace("Z",""))+datetime.timedelta(minutes=15)).isoformat()+"Z")' "$START")"
APPT=$(api POST /v1/appointments "$FRONT" "{\"patientId\":\"$PATIENT_ID\",\"practitionerId\":\"$PRAC\",\"facilityId\":\"$FAC\",\"departmentId\":\"$DEPT\",\"startAt\":\"$START\",\"endAt\":\"$END\",\"appointmentType\":\"routine\",\"reasonText\":\"Fever and cough, 3 days\"}" "Idempotency-Key: $(uuid)" | jget id)
ENC=$(api POST "/v1/appointments/$APPT/check-in" "$FRONT" '' "Idempotency-Key: $(uuid)" | jget encounterId)
api POST "/v1/encounters/$ENC/observations" "$DOC" '{"code":{"system":"http://loinc.org","code":"8310-5","display":"Body temperature"},"valueNumeric":38.6,"unit":"Cel"}' >/dev/null
api POST "/v1/encounters/$ENC/conditions" "$DOC" '{"code":{"system":"http://hl7.org/fhir/sid/icd-10","code":"J06.9","display":"Acute upper respiratory infection, unspecified"},"category":"diagnosis"}' >/dev/null
VER=$(api GET "/v1/encounters/$ENC" "$DOC" | jget version)
api POST "/v1/encounters/$ENC/sign" "$DOC" '{"attestation":true}' "If-Match: $VER" >/dev/null
INV=$(api POST "/v1/encounters/$ENC/invoice" "$FRONT" '{"consultationFee":"500.00"}' | jget id)
api POST "/v1/invoices/$INV/pay" "$FRONT" '{"method":"upi"}' "Idempotency-Key: $(uuid)" >/dev/null
echo "seeded portal history for Anaya: appointment $START, diagnosis J06.9, invoice paid ₹500"
