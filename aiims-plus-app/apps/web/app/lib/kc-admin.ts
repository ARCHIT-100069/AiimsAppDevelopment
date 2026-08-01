/**
 * Minimal Keycloak Admin API client for self-service registration. Runs only in
 * server route handlers. Uses a master-realm admin service account to create
 * users, set their attributes (tenant_id / patient_id → token claims via the
 * realm's protocol mappers), and assign realm roles. Env-configurable so it
 * points at the real IdP in other environments.
 */
const issuerUrl = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const kcBase = () => new URL(issuerUrl()).origin;
const realm = () => new URL(issuerUrl()).pathname.split("/").filter(Boolean).pop() ?? "aiims";
const adminUser = () => process.env.KC_ADMIN_USER ?? "admin";
const adminPass = () => process.env.KC_ADMIN_PASSWORD ?? "admin";

export const TENANT_A = process.env.DEFAULT_TENANT_ID ?? "0197a000-0000-7000-8000-00000000000a";

async function adminToken(): Promise<string> {
  const res = await fetch(`${kcBase()}/realms/master/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: adminUser(),
      password: adminPass(),
    }),
  });
  if (!res.ok) throw new Error(`kc admin token failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

export class UsernameTakenError extends Error {}

export interface CreateKcUserInput {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  attributes: Record<string, string[]>;
  realmRole: string;
}

/** Create a Keycloak user (+ password + attributes) and assign a realm role.
 *  Returns the new Keycloak user id (the token `sub`). */
export async function createKcUser(input: CreateKcUserInput): Promise<string> {
  const tok = await adminToken();
  const r = realm();

  // An email is REQUIRED: the realm's VERIFY_PROFILE action otherwise fails the
  // direct-grant login with "Account is not fully set up". Synthesize one when
  // the caller has none.
  const email = input.email || `${input.username}@patient.aiims.local`;

  const create = await fetch(`${kcBase()}/admin/realms/${r}/users`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
    body: JSON.stringify({
      username: input.username,
      enabled: true,
      email,
      emailVerified: true,
      firstName: input.firstName,
      lastName: input.lastName,
      attributes: input.attributes,
      // Clear any realm default required actions so direct-grant login isn't
      // blocked by "Account is not fully set up".
      requiredActions: [],
    }),
  });
  if (create.status === 409) throw new UsernameTakenError("username already exists");
  if (!create.ok && create.status !== 201) {
    throw new Error(`kc create user failed: ${create.status}`);
  }

  // The 201 Location header ends with the new user id.
  let userId = create.headers.get("location")?.split("/").pop() ?? "";
  if (!userId) {
    const found = await fetch(
      `${kcBase()}/admin/realms/${r}/users?username=${encodeURIComponent(input.username)}&exact=true`,
      { headers: { authorization: `Bearer ${tok}` } },
    );
    const users = (await found.json()) as { id: string }[];
    userId = users[0]?.id ?? "";
  }
  if (!userId) throw new Error("kc create user: no id");

  // Set the password explicitly (inline credentials on create are unreliable and
  // can leave the account "not fully set up" for the direct grant).
  const pwRes = await fetch(`${kcBase()}/admin/realms/${r}/users/${userId}/reset-password`, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
    body: JSON.stringify({ type: "password", value: input.password, temporary: false }),
  });
  if (!pwRes.ok) throw new Error(`kc set password failed: ${pwRes.status}`);

  // Assign the realm role.
  const roleRes = await fetch(`${kcBase()}/admin/realms/${r}/roles/${input.realmRole}`, {
    headers: { authorization: `Bearer ${tok}` },
  });
  if (roleRes.ok) {
    const role = await roleRes.json();
    await fetch(`${kcBase()}/admin/realms/${r}/users/${userId}/role-mappings/realm`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
      body: JSON.stringify([role]),
    });
  }

  return userId;
}
