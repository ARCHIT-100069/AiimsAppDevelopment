import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { apiFetch } from "../../../lib/api";
import { createKcUser, TENANT_A, UsernameTakenError } from "../../../lib/kc-admin";

const CLINICAL = new Set(["doctor", "nurse"]);

/**
 * Admin "Add staff": create a Keycloak login (realm role + tenant claim) AND the
 * matching app_user + DB role in one step — and a practitioner profile for
 * clinical roles so a new doctor is immediately bookable and can prescribe.
 * Runs under the admin's session (the API enforces user:manage / practitioner:manage).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    nameGiven?: string;
    nameFamily?: string;
    username?: string;
    password?: string;
    role?: string;
  };
  const nameGiven = (body.nameGiven ?? "").trim();
  const nameFamily = (body.nameFamily ?? "").trim();
  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role ?? "";

  if (!nameGiven || !nameFamily || !username || password.length < 4) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  if (!["doctor", "nurse", "front_desk", "admin"].includes(role)) {
    return NextResponse.json({ error: "role" }, { status: 400 });
  }

  // 1) Keycloak user with the staff realm role + tenant claim.
  let keycloakSub: string;
  try {
    keycloakSub = await createKcUser({
      username,
      password,
      firstName: nameGiven,
      lastName: nameFamily,
      realmRole: role,
      attributes: { tenant_id: [TENANT_A] },
    });
  } catch (e) {
    if (e instanceof UsernameTakenError) {
      return NextResponse.json({ error: "taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "keycloak" }, { status: 502 });
  }

  // 2) app_user (audited) under the admin's tenant.
  const userRes = await apiFetch("/v1/users", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
    body: JSON.stringify({ keycloakSub, displayName: `${nameGiven} ${nameFamily}` }),
  });
  if (!userRes.ok) {
    return NextResponse.json({ error: "user", status: userRes.status }, { status: 502 });
  }
  const appUserId = ((await userRes.json()) as { id: string }).id;

  // 3) DB role assignment.
  const roleRes = await apiFetch(`/v1/users/${appUserId}/roles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ roleCode: role }),
  });
  if (!roleRes.ok) {
    return NextResponse.json({ error: "user", status: roleRes.status }, { status: 502 });
  }

  // 4) Practitioner profile for clinical roles (best-effort: needs a department).
  let practitioner = false;
  if (CLINICAL.has(role)) {
    const departmentId = await firstDepartmentId();
    if (departmentId) {
      const pr = await apiFetch("/v1/practitioners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appUserId,
          registrationNo: `MCI-${Date.now()}`,
          departmentId,
          nameGiven,
          nameFamily,
        }),
      });
      practitioner = pr.ok;
    }
  }

  return NextResponse.json({ ok: true, appUserId, practitioner });
}

/** First department the admin can see (single-campus MVP). */
async function firstDepartmentId(): Promise<string | null> {
  const orgs = await apiFetch("/v1/organizations").then((r) => (r.ok ? r.json() : { data: [] }));
  for (const o of (orgs.data ?? []) as { id: string }[]) {
    const facs = await apiFetch(`/v1/facilities?organizationId=${o.id}`).then((r) =>
      r.ok ? r.json() : { data: [] },
    );
    for (const f of (facs.data ?? []) as { id: string }[]) {
      const depts = await apiFetch(`/v1/departments?facilityId=${f.id}`).then((r) =>
        r.ok ? r.json() : { data: [] },
      );
      const first = (depts.data ?? [])[0] as { id: string } | undefined;
      if (first) return first.id;
    }
  }
  return null;
}
