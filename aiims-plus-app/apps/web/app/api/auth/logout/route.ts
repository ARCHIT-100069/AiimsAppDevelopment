import { NextResponse, type NextRequest } from "next/server";
import { clearSession, readIdToken, readSession } from "../../../lib/session";

const issuer = () => process.env.OIDC_ISSUER_URL ?? "http://localhost:8080/realms/aiims";
const clientId = () => process.env.OIDC_CLIENT_ID ?? "aiims-web";

/**
 * Logout. Two flows:
 *  • Native password grant (the default) creates NO Keycloak browser SSO
 *    session, so we simply clear our own cookies and return to /login. This is
 *    instant and lets a different user sign in immediately on the same device.
 *  • Redirect SSO login DID create a Keycloak session; for it we do an
 *    RP-initiated logout (id_token_hint + post_logout_redirect_uri) so the SSO
 *    session ends and the next sign-in isn't silently re-authenticated.
 */
export async function POST(req: NextRequest) {
  const session = await readSession();
  const idToken = await readIdToken();
  await clearSession();

  const loginUrl = new URL("/login", req.url).toString();

  if (session?.viaSso && idToken) {
    const params = new URLSearchParams({
      post_logout_redirect_uri: loginUrl,
      client_id: clientId(),
      id_token_hint: idToken,
    });
    return NextResponse.redirect(`${issuer()}/protocol/openid-connect/logout?${params}`, {
      status: 303,
    });
  }

  return NextResponse.redirect(loginUrl, { status: 303 });
}
