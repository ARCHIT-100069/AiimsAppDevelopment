#!/usr/bin/env bash
# One-command dev/demo launcher for AIIMS+.
#
# Brings up EVERYTHING in order and waits for each piece to be healthy, so a
# pitch is never blocked on a half-started stack:
#   1. Docker infra (Postgres, Keycloak, MinIO, Redis)
#   2. DB migrate + seed (idempotent)
#   3. API on :3000  (env loaded from root .env)
#   4. Web on :3001  (env loaded from root .env + apps/web/.env.local)
# Then prints the link + demo credentials. Re-runnable; safe to run twice.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export DOCKER_HOST="${DOCKER_HOST:-unix:///Users/$USER/.colima/default/docker.sock}"

log() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
ok()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

wait_http() { # url, name, tries
  local url="$1" name="$2" tries="${3:-60}"
  for _ in $(seq 1 "$tries"); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || echo 000)" != "000" ] \
      && { ok "$name ready"; return 0; }
    sleep 1
  done
  die "$name did not come up ($url)"
}

[ -f .env ] || die "root .env is missing — copy .env.example and fill it in"
set -a; . ./.env; set +a

# 1) infra
log "starting Docker infra (postgres, keycloak, minio, redis)…"
docker compose up -d
wait_http "http://localhost:8080/realms/aiims/.well-known/openid-configuration" "Keycloak realm" 90

# 2) db
log "migrate + seed (idempotent)…"
pnpm --filter @aiims/db migrate >/dev/null
pnpm --filter @aiims/db seed >/dev/null || true
# Enable the AI coding-assist capability (dark by default) so the demo works.
docker exec aiims-plus-app-postgres-1 psql -U postgres -d aiims -qtc \
  "INSERT INTO platform.feature_flag (id,tenant_id,key,enabled) VALUES (gen_random_uuid(),NULL,'ai.coding_assist',true) ON CONFLICT (tenant_id,key) DO UPDATE SET enabled=true;" >/dev/null 2>&1 || true
ok "database ready (AI coding-assist enabled)"

# 3) api
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:3000/healthz 2>/dev/null || echo 000)" = "200" ]; then
  ok "API already running"
else
  log "starting API on :3000…"
  ( pnpm --filter @aiims/api build >/dev/null && node --env-file=.env apps/api/dist/main.js ) > /tmp/aiims-api.log 2>&1 &
  wait_http "http://localhost:3000/healthz" "API" 60
fi

# patient portal: Keycloak role/mapper/user + Anaya's demo clinical history
log "configuring patient portal (Keycloak + demo history)…"
python3 scripts/setup_patient_portal.py || true
bash scripts/seed-portal-history.sh || true
ok "patient portal ready (anaya / patient)"

# 4) web
if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:3001/login 2>/dev/null || echo 000)" = "200" ]; then
  ok "Web already running"
else
  log "starting Web on :3001…"
  ( cd apps/web && PORT=3001 pnpm exec next dev -p 3001 ) > /tmp/aiims-web.log 2>&1 &
  wait_http "http://localhost:3001/login" "Web" 60
fi

cat <<BANNER

  ────────────────────────────────────────────────
   AIIMS+ is up.  Open →  http://localhost:3001
   Sign in with Keycloak:
     doctor.a / doctor      admin.a / admin
     platform.admin / platform
  ────────────────────────────────────────────────
   API   http://localhost:3000/healthz
   Logs  /tmp/aiims-api.log   /tmp/aiims-web.log
BANNER
