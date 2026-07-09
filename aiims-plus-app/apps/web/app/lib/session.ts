/**
 * BFF session (SDR-0001 / FEDR-0007): OIDC tokens live SERVER-SIDE only, in
 * an AES-256-GCM-encrypted httpOnly/SameSite cookie. The browser never holds
 * a token; the clinical app calls same-origin BFF routes that attach the
 * bearer. No PHI is ever placed in the session (SDR-0004/FEDR-0013).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "aiims_session";
const MAX_AGE = 60 * 30; // 30 min; refreshed server-side on use

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** epoch seconds */
  expiresAt: number;
  displayName: string;
  roles: string[];
  /** id_token — needed as id_token_hint for RP-initiated (SSO) logout. */
  idToken?: string;
}

function sessionKey(): Buffer {
  const hex = process.env.SESSION_SECRET;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("SESSION_SECRET must be 64 hex chars (BFF cookie encryption, SDR-0001)");
  }
  return Buffer.from(hex, "hex");
}

export async function writeSession(session: Session): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const value = Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString(
      "utf8",
    );
    return JSON.parse(json) as Session;
  } catch {
    return null; // tampered/expired → treated as logged-out
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
