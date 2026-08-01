import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { decodeClaims, passwordGrant } from "../../../lib/oidc";
import { writeSession, writeIdToken } from "../../../lib/session";
import { createKcUser, TENANT_A, UsernameTakenError } from "../../../lib/kc-admin";

const apiBase = () => process.env.API_BASE_URL ?? "http://localhost:3000";
const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
// Service account used only to create the patient RECORD via the audited API
// (front desk owns patient registration). Keycloak user creation uses the admin.
const registrarUser = () => process.env.REGISTRAR_USER ?? "frontdesk.a";
const registrarPass = () => process.env.REGISTRAR_PASSWORD ?? "frontdesk";

const fail = (req: NextRequest, code: string) =>
  NextResponse.redirect(new URL(`/register?error=${code}`, req.url), { status: 303 });

/**
 * Patient self-registration: create the audited patient RECORD (front-desk
 * service account) + a Keycloak user carrying tenant_id/patient_id claims, then
 * sign the new patient straight in. Public endpoint (no session required).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const nameGiven = String(form.get("nameGiven") ?? "").trim();
  const nameFamily = String(form.get("nameFamily") ?? "").trim();
  const gender = String(form.get("gender") ?? "").trim();
  const birthDate = String(form.get("birthDate") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!nameGiven || !nameFamily || !gender || !birthDate || !username || password.length < 4) {
    return fail(req, "missing");
  }

  // 1) Registrar token → create the patient record via the audited API.
  let patientId: string;
  try {
    const tokRes = await fetch(`${issuer()}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "aiims-cli",
        username: registrarUser(),
        password: registrarPass(),
      }),
    });
    if (!tokRes.ok) return fail(req, "server");
    const registrarToken = ((await tokRes.json()) as { access_token: string }).access_token;

    const patRes = await fetch(`${apiBase()}/v1/patients`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
        authorization: `Bearer ${registrarToken}`,
      },
      body: JSON.stringify({
        nameGiven,
        nameFamily,
        gender,
        birthDate,
        ...(phone ? { phone } : {}),
        requestAbha: true,
      }),
    });
    if (!patRes.ok) return fail(req, "record");
    patientId = ((await patRes.json()) as { id: string }).id;
  } catch {
    return fail(req, "server");
  }

  // 2) Create the Keycloak user with tenant_id + patient_id claims.
  try {
    await createKcUser({
      username,
      password,
      firstName: nameGiven,
      lastName: nameFamily,
      realmRole: "patient",
      attributes: { tenant_id: [TENANT_A], patient_id: [patientId] },
    });
  } catch (e) {
    if (e instanceof UsernameTakenError) return fail(req, "taken");
    return fail(req, "server");
  }

  // 3) Auto sign-in the new patient.
  try {
    const tokens = await passwordGrant(username, password);
    const claims = decodeClaims(tokens.access_token);
    await writeSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      displayName: claims.name ?? `${nameGiven} ${nameFamily}`,
      roles: claims.realm_access?.roles ?? ["patient"],
    });
    await writeIdToken(tokens.id_token);
    return NextResponse.redirect(new URL("/portal", req.url), { status: 303 });
  } catch {
    // Account was created; just send them to sign in.
    return NextResponse.redirect(new URL("/login?registered=1", req.url), { status: 303 });
  }
}
