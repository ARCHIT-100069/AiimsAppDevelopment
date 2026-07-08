#!/usr/bin/env bash
# 10-second pre-flight before a demo/pitch. Green across the board = safe to present.
set -uo pipefail
export DOCKER_HOST="${DOCKER_HOST:-unix:///Users/$USER/.colima/default/docker.sock}"

check() { # label, url, expected-nonzero-code
  local label="$1" url="$2"
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)
  if [ "$code" = "000" ]; then printf '\033[31m✗ %-24s DOWN\033[0m\n' "$label"; return 1
  else printf '\033[32m✓ %-24s %s\033[0m\n' "$label" "$code"; fi
}

fail=0
check "Keycloak (:8080)"  "http://localhost:8080/realms/aiims/.well-known/openid-configuration" || fail=1
check "API (:3000)"       "http://localhost:3000/healthz" || fail=1
check "Web login (:3001)" "http://localhost:3001/login" || fail=1

# password sanity: which realm is live? (dev creds)
if curl -s --max-time 3 -X POST "http://localhost:8080/realms/aiims/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=aiims-cli -d username=doctor.a -d password=doctor \
    | grep -q access_token; then
  printf '\033[32m✓ %-24s doctor.a/doctor works\033[0m\n' "Login credentials"
elif curl -s --max-time 3 -X POST "http://localhost:8080/realms/aiims/protocol/openid-connect/token" \
    -d grant_type=password -d client_id=aiims-cli -d username=doctor.a -d password='DevDoctor#2026' \
    | grep -q access_token; then
  printf '\033[33m! %-24s use DevDoctor#2026 (hardened realm)\033[0m\n' "Login credentials"
else
  printf '\033[31m✗ %-24s neither password works\033[0m\n' "Login credentials"; fail=1
fi

echo
[ "$fail" = 0 ] && printf '\033[32mALL GREEN — open http://localhost:3001\033[0m\n' \
                || printf '\033[31mNOT READY — run scripts/dev-up.sh\033[0m\n'
exit $fail
