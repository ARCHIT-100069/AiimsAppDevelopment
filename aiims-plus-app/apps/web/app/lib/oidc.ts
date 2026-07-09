/**
 * OIDC Authorization Code + PKCE against Keycloak (SDR-0001). Runs only in
 * Next route handlers (server) — the code_verifier is held in a short-lived
 * httpOnly cookie, never exposed to the browser.
 */
import { createHash, randomBytes } from "node:crypto";

const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const clientId = () => process.env.OIDC_CLIENT_ID ?? "aiims-web";
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
    // Always show the login form, even if a Keycloak SSO session exists. Without
    // this, after logout the next "Sign in" silently re-authenticates the same
    // user (Keycloak keeps its own session). prompt=login lets you switch users.
    prompt: "login",
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
