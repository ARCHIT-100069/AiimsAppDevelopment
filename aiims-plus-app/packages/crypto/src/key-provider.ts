/**
 * The key-management seam (SDR-0005 realized per ADR-0010): envelope
 * encryption's wrap/unwrap is provider-abstracted so the SAME call sites and
 * key-reference format serve the local dev provider today and AWS KMS
 * (GenerateDataKey/Decrypt against the CMK hierarchy) at AWS bootstrap —
 * no schema or code change, only configuration.
 */

export interface DataKey {
  /** 32-byte AES-256 key — exists in memory only, never persisted (SDR-0005). */
  readonly plaintext: Buffer;
  /** Provider-wrapped form, persisted in enc_key_ref. Destroy it → crypto-shred (ADR-0009). */
  readonly wrapped: Buffer;
}

export interface KeyProvider {
  /** Prefixes enc_key_ref so ciphertexts are self-describing ("local", "aws-kms"). */
  readonly id: string;
  generateDataKey(): Promise<DataKey>;
  unwrapDataKey(wrapped: Buffer): Promise<Buffer>;
  /** Purpose-bound key for blind indexes (DDR-0006) — distinct from data keys. */
  indexKey(): Buffer;
}

/** enc_key_ref format: `<provider-id>.<base64url(wrapped)>`. */
export function encodeKeyRef(providerId: string, wrapped: Buffer): string {
  return `${providerId}.${wrapped.toString("base64url")}`;
}

export function decodeKeyRef(keyRef: string): { providerId: string; wrapped: Buffer } {
  const dot = keyRef.indexOf(".");
  if (dot <= 0) throw new Error("Malformed key reference");
  return {
    providerId: keyRef.slice(0, dot),
    wrapped: Buffer.from(keyRef.slice(dot + 1), "base64url"),
  };
}
