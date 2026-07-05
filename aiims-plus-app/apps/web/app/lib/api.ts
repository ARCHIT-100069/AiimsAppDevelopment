/**
 * BFF → API proxy (FEDR-0006). Runs server-side in route handlers; attaches
 * the bearer from the encrypted session and refreshes it when expired. The
 * browser only ever talks to same-origin /api/bff/* — never the API directly,
 * never holding a token.
 */
import { refresh } from "./oidc";
import { readSession, writeSession, type Session } from "./session";

const apiBase = () => process.env.API_BASE_URL ?? "http://localhost:3000";

async function freshToken(session: Session): Promise<Session> {
  if (session.expiresAt - 30 > Math.floor(Date.now() / 1000)) return session;
  const tokens = await refresh(session.refreshToken);
  const next: Session = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
  };
  await writeSession(next);
  return next;
}

/** Proxy a request to the API with the session bearer. Returns the raw Response. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = await readSession();
  if (!session) return new Response(null, { status: 401 });
  const live = await freshToken(session);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${live.accessToken}`);
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}
