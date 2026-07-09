import { NextResponse, type NextRequest } from "next/server";
import { clearSession, readIdToken } from "../../../lib/session";

const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const clientId = () => process.env.OIDC_CLIENT_ID ?? "aiims-web";

/**
 * RP-initiated logout (OIDC). Clearing our own session is not enough: Keycloak
 * keeps an SSO session, so the next "Sign in" would silently re-authenticate the
 * SAME user. We redirect the browser to Keycloak's end-session endpoint with the
 * id_token_hint (so no logout-confirmation prompt) and post_logout_redirect_uri
 * back to /login. The aiims-web client registers this URI (post.logout
 * .redirect.uris = "+"), so Keycloak ends the SSO session and returns cleanly —
 * letting the next user sign in as someone else.
 */
export async function POST(req: NextRequest) {
  const idToken = await readIdToken();
  await clearSession();

  const postLogout = new URL("/login", req.url).toString();
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogout,
    client_id: clientId(),
  });
  if (idToken) params.set("id_token_hint", idToken);

  return NextResponse.redirect(`${issuer()}/protocol/openid-connect/logout?${params}`, {
    status: 303,
  });
}
