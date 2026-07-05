import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, base64url, createPkce } from "../../../lib/oidc";

/** Start Authorization Code + PKCE (SDR-0001). Verifier stays server-side. */
export async function GET() {
  const { verifier, challenge } = createPkce();
  const state = base64url(randomBytes(16));
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  } as const;
  jar.set("pkce_verifier", verifier, opts);
  jar.set("oidc_state", state, opts);
  return NextResponse.redirect(authorizeUrl(challenge, state));
}
