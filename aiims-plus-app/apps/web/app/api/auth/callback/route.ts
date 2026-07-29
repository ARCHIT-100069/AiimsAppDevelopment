import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeClaims, exchangeCode } from "../../../lib/oidc";
import { homeFor } from "../../../lib/roles";
import { writeSession, writeIdToken } from "../../../lib/session";

/** OIDC redirect target: exchange code → tokens, seal them into the session. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const verifier = jar.get("pkce_verifier")?.value;
  const expectedState = jar.get("oidc_state")?.value;

  if (!code || !state || !verifier || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=auth", req.url));
  }

  let home = "/patients";
  try {
    const tokens = await exchangeCode(code, verifier);
    const claims = decodeClaims(tokens.access_token);
    const roles = claims.realm_access?.roles ?? [];
    await writeSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      displayName: claims.name ?? "Clinician",
      roles,
      viaSso: true,
    });
    await writeIdToken(tokens.id_token);
    // Each role lands in its own console (patient → portal, admin → admin, …).
    home = homeFor(roles);
  } catch {
    return NextResponse.redirect(new URL("/login?error=token", req.url));
  } finally {
    jar.delete("pkce_verifier");
    jar.delete("oidc_state");
  }
  return NextResponse.redirect(new URL(home, req.url));
}
