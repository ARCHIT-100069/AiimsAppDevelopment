/**
 * Field-level envelope encryption (DDR-0006, ratified by SDR-0004):
 * one per-record data key encrypts each identifier field with AES-256-GCM.
 * The AAD binds ciphertext to tenant + record + field, so a ciphertext can
 * never be transplanted across rows, columns, or tenants. Destroying the
 * wrapped key in enc_key_ref crypto-shreds the record (ADR-0009).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { decodeKeyRef, encodeKeyRef, type KeyProvider } from "./key-provider";

export interface RecordAad {
  tenantId: string;
  recordId: string;
}

export type PlainFields = Record<string, string | null | undefined>;
export type CipherFields = Record<string, Buffer | null>;

const aadFor = (aad: RecordAad, field: string) =>
  Buffer.from(`${aad.tenantId}|${aad.recordId}|${field}`, "utf8");

function sealField(dataKey: Buffer, aad: Buffer, plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

function openField(dataKey: Buffer, aad: Buffer, sealed: Buffer): string {
  if (sealed.length < 12 + 16) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", dataKey, sealed.subarray(0, 12));
  decipher.setAuthTag(sealed.subarray(12, 28));
  decipher.setAAD(aad);
  return Buffer.concat([decipher.update(sealed.subarray(28)), decipher.final()]).toString("utf8");
}

export class FieldCipher {
  constructor(private readonly provider: KeyProvider) {}

  /** New record: fresh data key; null/undefined fields stay null (unencrypted absence). */
  async encryptRecord(
    fields: PlainFields,
    aad: RecordAad,
  ): Promise<{ keyRef: string; values: CipherFields }> {
    const { plaintext: dataKey, wrapped } = await this.provider.generateDataKey();
    return {
      keyRef: encodeKeyRef(this.provider.id, wrapped),
      values: this.seal(dataKey, fields, aad),
    };
  }

  /** Update path: reuse the record's existing data key from enc_key_ref. */
  async encryptWithExistingKey(
    keyRef: string,
    fields: PlainFields,
    aad: RecordAad,
  ): Promise<CipherFields> {
    return this.seal(await this.unwrap(keyRef), fields, aad);
  }

  async decryptRecord(
    keyRef: string,
    values: CipherFields,
    aad: RecordAad,
  ): Promise<Record<string, string | null>> {
    const dataKey = await this.unwrap(keyRef);
    const out: Record<string, string | null> = {};
    for (const [field, sealed] of Object.entries(values)) {
      out[field] = sealed === null ? null : openField(dataKey, aadFor(aad, field), sealed);
    }
    return out;
  }

  private seal(dataKey: Buffer, fields: PlainFields, aad: RecordAad): CipherFields {
    const out: CipherFields = {};
    for (const [field, value] of Object.entries(fields)) {
      out[field] = value == null ? null : sealField(dataKey, aadFor(aad, field), value);
    }
    return out;
  }

  private async unwrap(keyRef: string): Promise<Buffer> {
    const { providerId, wrapped } = decodeKeyRef(keyRef);
    if (providerId !== this.provider.id) {
      throw new Error(
        `Key reference provider "${providerId}" does not match "${this.provider.id}"`,
      );
    }
    return this.provider.unwrapDataKey(wrapped);
  }
}
