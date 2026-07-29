/**
 * BFF session (SDR-0001 / FEDR-0007): OIDC tokens live SERVER-SIDE only, in
 * AES-256-GCM-encrypted httpOnly/SameSite cookies. The browser never holds a
 * usable token; the clinical app calls same-origin BFF routes that attach the
 * bearer. No PHI is ever placed in the session (SDR-0004/FEDR-0013).
 *
 * The session and the OIDC id_token are stored in SEPARATE cookies: three JWTs
 * in one cookie exceed the 4 KB browser limit and get silently dropped. The
 * id_token is only needed as the logout `id_token_hint`, so it lives on its own.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "aiims_session";
const ID_COOKIE = "aiims_oidc_id";
const MAX_AGE = 60 * 30; // 30 min; refreshed server-side on use

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch seconds */
  expiresAt: number;
  displayName: string;
  roles: string[];
  /** True only for the redirect (SSO) login, which creates a Keycloak browser
   *  session that logout must end. The native password grant sets no SSO
   *  session, so its logout is a simple local cookie clear. */
  viaSso?: boolean;
}

function sessionKey(): Buffer {
  const hex = process.env.SESSION_SECRET;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("SESSION_SECRET must be 64 hex chars (BFF cookie encryption, SDR-0001)");
  }
  return Buffer.from(hex, "hex");
}

function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

function open(value: string): string | null {
  try {
    const buf = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE,
} as const;

export async function writeSession(session: Session): Promise<void> {
  (await cookies()).set(COOKIE, seal(JSON.stringify(session)), cookieOpts);
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const json = open(raw);
  return json ? (JSON.parse(json) as Session) : null; // tampered/expired → logged-out
}

/** Store the OIDC id_token separately (logout hint only) to keep cookies small. */
export async function writeIdToken(idToken: string): Promise<void> {
  (await cookies()).set(ID_COOKIE, seal(idToken), cookieOpts);
}

export async function readIdToken(): Promise<string | null> {
  const raw = (await cookies()).get(ID_COOKIE)?.value;
  return raw ? open(raw) : null;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(ID_COOKIE);
}
