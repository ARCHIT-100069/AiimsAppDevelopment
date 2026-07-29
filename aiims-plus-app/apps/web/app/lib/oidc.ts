/**
 * OIDC Authorization Code + PKCE against Keycloak (SDR-0001). Runs only in
 * Next route handlers (server) — the code_verifier is held in a short-lived
 * httpOnly cookie, never exposed to the browser.
 */
import { createHash, randomBytes } from "node:crypto";

const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const clientId = () => process.env.OIDC_CLIENT_ID ?? "aiims-web";
// Public client that permits the direct password grant (used by the native
// in-app sign-in form). Unlike the redirect flow, the password grant never
// creates a Keycloak browser SSO session — so logging out and signing in as a
// different user on the same device is instant (no lingering SSO to clear).
const cliClientId = () => process.env.OIDC_CLI_CLIENT_ID ?? "aiims-cli";
const redirectUri = () =>
  process.env.OIDC_REDIRECT_URI ?? "http://localhost:3001/api/auth/callback";

export function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function authorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    scope: "openid profile",
    redirect_uri: redirectUri(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${issuer()}/protocol/openid-connect/auth?${params}`;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token: string;
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenSet> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
}

export async function refresh(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

/**
 * Direct password grant against the CLI client — powers the native sign-in form.
 * Throws on bad credentials (caller maps to a friendly error). No SSO cookie is
 * set at Keycloak, so account-switching on one device is friction-free.
 */
export async function passwordGrant(username: string, password: string): Promise<TokenSet> {
  const res = await fetch(`${issuer()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cliClientId(),
      grant_type: "password",
      scope: "openid profile",
      username,
      password,
    }),
  });
  if (!res.ok) throw new Error(`password grant failed: ${res.status}`);
  return (await res.json()) as TokenSet;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${issuer()}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  if (!res.ok) throw new Error(`OIDC token request failed: ${res.status}`);
  return (await res.json()) as TokenSet;
}

/** Decode JWT claims without verification — display only; the API re-verifies. */
export function decodeClaims(token: string): {
  name?: string;
  realm_access?: { roles?: string[] };
} {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}
