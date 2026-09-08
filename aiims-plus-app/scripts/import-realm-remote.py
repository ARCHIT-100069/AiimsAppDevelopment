#!/usr/bin/env python3
"""One-shot: create the `aiims` realm on a running Keycloak from
docker/keycloak/realm-aiims.json via the Admin REST API.

Why this exists instead of `--import-realm` at boot: on a memory-capped
container (Render free/starter, 512Mi), the bulk import running concurrently
with the JVM's own startup (classloading/JIT warmup/schema init) reliably
OOM-killed the process before it ever opened a port. The same import against
an already-warm, idle server does not carry that concurrent cost.

Usage: KC_URL=https://<host> KC_BOOTSTRAP_PASSWORD=<pw> python3 scripts/import-realm-remote.py
"""
import json
import os
import sys
import urllib.request
import urllib.parse

BASE = os.environ["KC_URL"].rstrip("/")
ADMIN_USER = os.environ.get("KC_BOOTSTRAP_USERNAME", "admin")
ADMIN_PASSWORD = os.environ["KC_BOOTSTRAP_PASSWORD"]
REALM_FILE = os.path.join(os.path.dirname(__file__), "..", "docker", "keycloak", "realm-aiims.json")


def req(method, path, tok=None, body=None, form=None):
    url = BASE + path
    data = None
    headers = {}
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if tok:
        headers["Authorization"] = "Bearer " + tok
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        raw = resp.read()
        return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    status, tokj = req("POST", "/realms/master/protocol/openid-connect/token",
                        form={"grant_type": "password", "client_id": "admin-cli",
                              "username": ADMIN_USER, "password": ADMIN_PASSWORD})
    if status != 200:
        print(f"FATAL: master login failed ({status}): {tokj}", file=sys.stderr)
        sys.exit(1)
    tok = tokj["access_token"]

    with open(REALM_FILE) as f:
        realm = json.load(f)

    status, _ = req("GET", f"/admin/realms/{realm['realm']}", tok)
    if status == 200:
        print(f"realm '{realm['realm']}' already exists — nothing to do")
        return

    status, body = req("POST", "/admin/realms", tok, body=realm)
    if status not in (201, 204):
        print(f"FATAL: realm import failed ({status}): {body}", file=sys.stderr)
        sys.exit(1)
    print(f"created realm '{realm['realm']}'")


if __name__ == "__main__":
    main()
