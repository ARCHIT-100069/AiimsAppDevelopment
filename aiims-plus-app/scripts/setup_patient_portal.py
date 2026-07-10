#!/usr/bin/env python3
"""Configure the patient portal in Keycloak (idempotent).

- realm role `patient`
- a `patient_id` token mapper on the aiims-cli + aiims-web clients
- demo patient user `anaya` / `patient` with tenant_id + patient_id claims,
  granted the `patient` role.

Safe to re-run. Targets the running realm; fresh boots get the same config from
the realm JSON files.
"""
import json
import os
import sys
import urllib.request
import urllib.parse

BASE = os.environ.get("KC_URL", "http://localhost:8080")
REALM = "aiims"
TENANT_A = "0197a000-0000-7000-8000-00000000000a"
PATIENT_ID = "0197a000-0000-7000-8000-0000000000c1"


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
        resp = urllib.request.urlopen(r)
        raw = resp.read()
        return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    _, tokj = req("POST", "/realms/master/protocol/openid-connect/token",
                  form={"grant_type": "password", "client_id": "admin-cli",
                        "username": "admin", "password": "admin"})
    tok = tokj["access_token"]

    # 0) allow unmanaged user attributes (tenant_id/patient_id) — otherwise the
    # declarative user profile silently drops them on Admin-API writes and the
    # token mappers emit nothing.
    st, prof = req("GET", f"/admin/realms/{REALM}/users/profile", tok)
    if isinstance(prof, dict) and prof.get("unmanagedAttributePolicy") != "ENABLED":
        prof["unmanagedAttributePolicy"] = "ENABLED"
        req("PUT", f"/admin/realms/{REALM}/users/profile", tok, body=prof)
        print("enabled unmanaged user attributes")

    # 1) realm role `patient`
    st, _ = req("GET", f"/admin/realms/{REALM}/roles/patient", tok)
    if st == 404:
        req("POST", f"/admin/realms/{REALM}/roles", tok,
            body={"name": "patient", "description": "Patient portal — reads only their own record"})
        print("created realm role: patient")
    else:
        print("realm role patient: exists")

    # 2) patient_id token mapper on the interactive + cli clients
    for client_id in ("aiims-cli", "aiims-web"):
        _, clients = req("GET", f"/admin/realms/{REALM}/clients?clientId={client_id}", tok)
        cid = clients[0]["id"]
        _, mappers = req("GET", f"/admin/realms/{REALM}/clients/{cid}/protocol-mappers/models", tok)
        if any(m["name"] == "patient_id" for m in (mappers or [])):
            print(f"{client_id}: patient_id mapper exists")
            continue
        req("POST", f"/admin/realms/{REALM}/clients/{cid}/protocol-mappers/models", tok, body={
            "name": "patient_id",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-usermodel-attribute-mapper",
            "config": {
                "user.attribute": "patient_id",
                "claim.name": "patient_id",
                "jsonType.label": "String",
                "access.token.claim": "true",
                "id.token.claim": "true",
                "userinfo.token.claim": "true",
            },
        })
        print(f"{client_id}: added patient_id mapper")

    # 3) demo patient user `anaya`. Create in ONE call with credentials + an
    # empty requiredActions and a verified email — otherwise the direct-grant
    # "resolve required actions" step reports "Account is not fully set up".
    user_body = {
        "username": "anaya", "enabled": True,
        "email": "anaya.sharma@demo.aiims.dev", "emailVerified": True,
        "firstName": "Anaya", "lastName": "Sharma", "requiredActions": [],
        "attributes": {"tenant_id": [TENANT_A], "patient_id": [PATIENT_ID]},
        "credentials": [{"type": "password", "value": "patient", "temporary": False}],
    }
    _, users = req("GET", f"/admin/realms/{REALM}/users?username=anaya&exact=true", tok)
    if users:
        uid = users[0]["id"]
        req("PUT", f"/admin/realms/{REALM}/users/{uid}", tok, body=user_body)
        req("PUT", f"/admin/realms/{REALM}/users/{uid}/reset-password", tok,
            body={"type": "password", "value": "patient", "temporary": False})
        print("user anaya: updated")
    else:
        req("POST", f"/admin/realms/{REALM}/users", tok, body=user_body)
        _, users = req("GET", f"/admin/realms/{REALM}/users?username=anaya&exact=true", tok)
        uid = users[0]["id"]
        print("created user anaya")

    # grant realm role patient
    _, role = req("GET", f"/admin/realms/{REALM}/roles/patient", tok)
    req("POST", f"/admin/realms/{REALM}/users/{uid}/role-mappings/realm", tok,
        body=[{"id": role["id"], "name": "patient"}])
    print("anaya: password set + patient role granted")

    # 4) staff realm roles for WEB routing only. The API still authorises from
    # the DB (roleCodesForUser) — these Keycloak realm roles just let the web BFF
    # send each staff user to the right console (admin → /admin, doctor →
    # /doctor). Mirrors the seeded DB roles.
    staff_roles = {
        "admin.a": "admin", "admin.c": "admin",
        "doctor.a": "doctor", "doctor.b": "doctor",
        "frontdesk.a": "front_desk",
    }
    for role_name in set(staff_roles.values()):
        st, _ = req("GET", f"/admin/realms/{REALM}/roles/{role_name}", tok)
        if st == 404:
            req("POST", f"/admin/realms/{REALM}/roles", tok,
                body={"name": role_name, "description": f"Web console routing role ({role_name})"})
            print(f"created realm role: {role_name}")
    for username, role_name in staff_roles.items():
        _, us = req("GET", f"/admin/realms/{REALM}/users?username={username}&exact=true", tok)
        if not us:
            continue
        _, role = req("GET", f"/admin/realms/{REALM}/roles/{role_name}", tok)
        req("POST", f"/admin/realms/{REALM}/users/{us[0]['id']}/role-mappings/realm", tok,
            body=[{"id": role["id"], "name": role_name}])
    print("staff realm roles assigned (admin/doctor/front_desk)")
    print("\nPatient portal ready — sign in as  anaya / patient")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa
        print(f"setup_patient_portal error: {e}", file=sys.stderr)
        sys.exit(1)
