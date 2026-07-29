import { NextResponse, type NextRequest } from "next/server";
import { decodeClaims, passwordGrant } from "../../../lib/oidc";
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
    await writeSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      displayName: claims.name ?? username,
      roles,
    });
    await writeIdToken(tokens.id_token);
    return NextResponse.redirect(new URL(homeFor(roles), req.url), { status: 303 });
  } catch {
    return NextResponse.redirect(new URL("/login?error=credentials", req.url), { status: 303 });
  }
}
