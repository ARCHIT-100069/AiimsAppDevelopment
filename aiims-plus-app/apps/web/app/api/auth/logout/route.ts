import { NextResponse, type NextRequest } from "next/server";
import { clearSession, readSession } from "../../../lib/session";

const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const clientId = () => process.env.OIDC_CLIENT_ID ?? "aiims-web";

/**
 * RP-initiated logout (OIDC). Clearing our own session is not enough: Keycloak
 * keeps an SSO session, so the next "Sign in" would silently re-authenticate
 * the SAME user. We therefore also redirect the browser to Keycloak's
 * end-session endpoint so the SSO cookie is killed and the user genuinely lands
 * back on a fresh login (able to sign in as someone else).
 */
export async function POST(req: NextRequest) {
  const session = await readSession();
  await clearSession();

  const postLogout = new URL("/login", req.url).toString();
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogout,
    client_id: clientId(),
  });
  if (session?.idToken) params.set("id_token_hint", session.idToken);

  return NextResponse.redirect(`${issuer()}/protocol/openid-connect/logout?${params}`, {
    status: 303,
  });
}
