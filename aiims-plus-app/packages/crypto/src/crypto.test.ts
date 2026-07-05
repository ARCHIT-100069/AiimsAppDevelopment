import { describe, expect, it } from "vitest";
import { computeBlindIndex, normalizeForIndex } from "./blind-index";
import { FieldCipher } from "./field-cipher";
import { decodeKeyRef, encodeKeyRef } from "./key-provider";
import { LocalKeyProvider } from "./local-key-provider";

const MASTER = "a".repeat(64);
const INDEX = "b".repeat(64);
const provider = () => new LocalKeyProvider(MASTER, INDEX, "test");
const AAD = { tenantId: "tenant-1", recordId: "record-1" };

describe("LocalKeyProvider (dev-only seam for SDR-0005)", () => {
  it("REFUSES to construct in production", () => {
    expect(() => new LocalKeyProvider(MASTER, INDEX, "production")).toThrow(/dev-only/);
  });

  it("rejects malformed keys and identical purpose keys", () => {
    expect(() => new LocalKeyProvider("short", INDEX, "test")).toThrow(/64 hex/);
    expect(() => new LocalKeyProvider(MASTER, "zz".repeat(32), "test")).toThrow(/64 hex/);
    expect(() => new LocalKeyProvider(MASTER, MASTER, "test")).toThrow(/must differ/);
  });

  it("wraps and unwraps a data key; tampered wrap fails closed", async () => {
    const p = provider();
    const { plaintext, wrapped } = await p.generateDataKey();
    expect(plaintext).toHaveLength(32);
    expect((await p.unwrapDataKey(wrapped)).equals(plaintext)).toBe(true);
    const tampered = Buffer.from(wrapped);
    tampered[tampered.length - 1] ^= 0xff;
    await expect(p.unwrapDataKey(tampered)).rejects.toThrow();
    await expect(p.unwrapDataKey(Buffer.alloc(4))).rejects.toThrow(/Malformed/);
  });
});

describe("FieldCipher (DDR-0006 envelope encryption)", () => {
  it("round-trips a record; nulls pass through unencrypted-absent", async () => {
    const cipher = new FieldCipher(provider());
    const { keyRef, values } = await cipher.encryptRecord(
      { phone: "+919876543210", email: "asha@synthetic.dev", abha_number: null },
      AAD,
    );
    expect(values.phone).toBeInstanceOf(Buffer);
    expect(values.abha_number).toBeNull();
    expect(values.phone!.toString("utf8")).not.toContain("9876"); // actually encrypted
    const plain = await cipher.decryptRecord(keyRef, values, AAD);
    expect(plain).toEqual({
      phone: "+919876543210",
      email: "asha@synthetic.dev",
      abha_number: null,
    });
  });

  it("AAD binds ciphertext to tenant + record + field (no transplants)", async () => {
    const cipher = new FieldCipher(provider());
    const { keyRef, values } = await cipher.encryptRecord({ phone: "+919876543210" }, AAD);
    // different tenant
    await expect(
      cipher.decryptRecord(keyRef, values, { ...AAD, tenantId: "tenant-2" }),
    ).rejects.toThrow();
    // another record
    await expect(
      cipher.decryptRecord(keyRef, values, { ...AAD, recordId: "record-2" }),
    ).rejects.toThrow();
    // column swap: phone ciphertext presented as email
    await expect(cipher.decryptRecord(keyRef, { email: values.phone! }, AAD)).rejects.toThrow();
  });

  it("tampered ciphertext fails closed", async () => {
    const cipher = new FieldCipher(provider());
    const { keyRef, values } = await cipher.encryptRecord({ phone: "+919876543210" }, AAD);
    const tampered = Buffer.from(values.phone!);
    tampered[tampered.length - 1] ^= 0x01;
    await expect(cipher.decryptRecord(keyRef, { phone: tampered }, AAD)).rejects.toThrow();
    await expect(cipher.decryptRecord(keyRef, { phone: Buffer.alloc(3) }, AAD)).rejects.toThrow(
      /Malformed/,
    );
  });

  it("update path reuses the record's data key from enc_key_ref", async () => {
    const cipher = new FieldCipher(provider());
    const { keyRef } = await cipher.encryptRecord({ phone: "+919876543210" }, AAD);
    const updated = await cipher.encryptWithExistingKey(keyRef, { phone: "+918888877777" }, AAD);
    const plain = await cipher.decryptRecord(keyRef, updated, AAD);
    expect(plain.phone).toBe("+918888877777");
  });

  it("rejects a key reference from a different provider", async () => {
    const cipher = new FieldCipher(provider());
    const foreignRef = encodeKeyRef("aws-kms", Buffer.alloc(60));
    await expect(cipher.decryptRecord(foreignRef, {}, AAD)).rejects.toThrow(/does not match/);
    expect(() => decodeKeyRef("no-dot")).toThrow(/Malformed/);
  });
});

describe("blind indexes (tenant-salted, DDR-0006)", () => {
  const key = Buffer.from(INDEX, "hex");

  it("normalization collapses input variants onto one digest", () => {
    const a = computeBlindIndex(key, "t1", "phone", "+91 98765-43210");
    const b = computeBlindIndex(key, "t1", "phone", "919876543210");
    const c = computeBlindIndex(key, "t1", "phone", "9876543210"); // India default
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(true);
    expect(normalizeForIndex("email", "  Asha@Example.COM ")).toBe("asha@example.com");
    expect(normalizeForIndex("abha", "12-3456-7890-1234")).toBe("12345678901234");
  });

  it("the SAME identifier in DIFFERENT tenants yields DIFFERENT digests", () => {
    const t1 = computeBlindIndex(key, "tenant-1", "phone", "9876543210");
    const t2 = computeBlindIndex(key, "tenant-2", "phone", "9876543210");
    expect(t1.equals(t2)).toBe(false);
  });

  it("different kinds never collide for the same value", () => {
    const p = computeBlindIndex(key, "t1", "phone", "1234567890");
    const a = computeBlindIndex(key, "t1", "abha", "1234567890");
    expect(p.equals(a)).toBe(false);
  });
});
