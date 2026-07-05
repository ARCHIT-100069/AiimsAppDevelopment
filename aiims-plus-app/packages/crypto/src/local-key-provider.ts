/**
 * LOCAL DEVELOPMENT key provider — wraps data keys with an env-supplied
 * master key (AES-256-GCM). Exists so the frozen envelope structure
 * (DDR-0006) runs on the compose substrate before AWS exists (IDR-0016
 * parity principle). REFUSES to construct in production: the production
 * provider is AWS KMS (SDR-0005), wired at AWS bootstrap.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { DataKey, KeyProvider } from "./key-provider";

const KEY_HEX = /^[0-9a-f]{64}$/i; // 32 bytes

export class LocalKeyProvider implements KeyProvider {
  readonly id = "local";
  private readonly masterKey: Buffer;
  private readonly idxKey: Buffer;

  constructor(masterKeyHex: string, indexKeyHex: string, nodeEnv = process.env.NODE_ENV) {
    if (nodeEnv === "production") {
      throw new Error(
        "LocalKeyProvider is dev-only — production uses AWS KMS (SDR-0005). Refusing to start.",
      );
    }
    if (!KEY_HEX.test(masterKeyHex)) throw new Error("AIIMS_FIELD_MASTER_KEY must be 64 hex chars");
    if (!KEY_HEX.test(indexKeyHex)) throw new Error("AIIMS_BLIND_INDEX_KEY must be 64 hex chars");
    this.masterKey = Buffer.from(masterKeyHex, "hex");
    this.idxKey = Buffer.from(indexKeyHex, "hex");
    if (this.masterKey.equals(this.idxKey)) {
      throw new Error("Field master key and blind-index key must differ (purpose-bound keys)");
    }
  }

  async generateDataKey(): Promise<DataKey> {
    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { plaintext, wrapped: Buffer.concat([iv, cipher.getAuthTag(), ct]) };
  }

  async unwrapDataKey(wrapped: Buffer): Promise<Buffer> {
    if (wrapped.length < 12 + 16 + 32) throw new Error("Malformed wrapped key");
    const iv = wrapped.subarray(0, 12);
    const tag = wrapped.subarray(12, 28);
    const ct = wrapped.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  }

  indexKey(): Buffer {
    return this.idxKey;
  }
}
