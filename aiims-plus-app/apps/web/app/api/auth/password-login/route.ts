import { NextResponse, type NextRequest } from "next/server";
import { decodeClaims, isDisabledStaffAccount, passwordGrant } from "../../../lib/oidc";
import { homeFor } from "../../../lib/roles";
import { writeSession, writeIdToken } from "../../../lib/session";

/**
 * Native sign-in: authenticate a username/password directly against Keycloak
 * (password grant) and seal the tokens into the BFF session — no redirect to
 * Keycloak's own login page, and no lingering SSO session, so switching users
 * on the same device just works.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!username || !password) {
    return NextResponse.redirect(new URL("/login?error=credentials", req.url), { status: 303 });
  }

  try {
    const tokens = await passwordGrant(username, password);
    const claims = decodeClaims(tokens.access_token);
    const roles = claims.realm_access?.roles ?? [];

    if (await isDisabledStaffAccount(tokens.access_token, roles)) {
      return NextResponse.redirect(new URL("/login?error=disabled", req.url), { status: 303 });
    }

    await writeSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      displayName: claims.name ?? username,
      roles,
    });
    await writeIdToken(tokens.id_token);
    return NextResponse.redirect(new URL(homeFor(roles), req.url), { status: 303 });
  } catch (err) {
    // Keycloak reachable but rejected the credentials (4xx) vs. Keycloak
    // unreachable entirely (network error, 5xx) — these need different
    // messages, or an outage reads to the user as "you mistyped your
    // password" instead of "the identity service is down".
    const rejectedCredentials =
      err instanceof Error && /password grant failed: 4\d\d/.test(err.message);
    const code = rejectedCredentials ? "credentials" : "service";
    return NextResponse.redirect(new URL(`/login?error=${code}`, req.url), { status: 303 });
  }
}
