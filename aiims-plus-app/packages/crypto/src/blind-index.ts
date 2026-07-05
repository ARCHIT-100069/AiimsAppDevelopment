/**
 * Blind indexes (DDR-0006): keyed HMAC-SHA256 digests enabling exact-match
 * lookup on encrypted identifiers WITHOUT decryption. The digest input is
 * TENANT-SALTED (founder decision S2-f): the same phone number in two
 * tenants yields different digests, so the index can never correlate
 * identities across tenants — defense-in-depth on top of RLS.
 */
import { createHmac } from "node:crypto";

export type BlindIndexKind = "phone" | "email" | "abha";

/** Normalization makes user-input variants collide onto one digest. */
export function normalizeForIndex(kind: BlindIndexKind, value: string): string {
  switch (kind) {
    case "phone": {
      const digits = value.replace(/[^0-9]/g, "");
      // India-first default (ADR-0007 market): bare 10-digit numbers get 91.
      return digits.length === 10 ? `91${digits}` : digits;
    }
    case "email":
      return value.trim().toLowerCase();
    case "abha":
      return value.replace(/[^0-9]/g, "");
  }
}

export function computeBlindIndex(
  indexKey: Buffer,
  tenantId: string,
  kind: BlindIndexKind,
  value: string,
): Buffer {
  return createHmac("sha256", indexKey)
    .update(`${tenantId}|${kind}|${normalizeForIndex(kind, value)}`)
    .digest();
}
