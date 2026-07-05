/**
 * Stage 2 integration suite (TDR-0003): encryption + persistence + RLS
 * against real Postgres as `aiims_app`. Proves the §12 testing requirements:
 * encryption/blind-index lookup under RLS, ciphertext-at-rest, optimistic
 * concurrency, idempotency persistence, and concurrent MRN uniqueness.
 */
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeBlindIndex, FieldCipher, LocalKeyProvider } from "@aiims/crypto";
import {
  createAppPool,
  findIdempotentResource,
  findPatientByBlindIndex,
  getPatientById,
  insertPatient,
  issueMrn,
  newId,
  saveIdempotencyKey,
  searchPatientsByText,
  SEED,
  updatePatientVersioned,
  withTenantContext,
} from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

const MASTER = "1".repeat(64);
const INDEX = "2".repeat(64);
const provider = new LocalKeyProvider(MASTER, INDEX, "test");
const cipher = new FieldCipher(provider);
const bidx = (kind: "phone" | "email" | "abha", tenantId: string, value: string) =>
  computeBlindIndex(provider.indexKey(), tenantId, kind, value);

let env: IsolationEnv;
let appPool: Pool;

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const PHONE = "+919876500001";

async function insertEncryptedPatient(
  ctx: typeof A,
  nameGiven: string,
  phone: string,
): Promise<string> {
  const id = newId();
  await withTenantContext(appPool, ctx, async (db) => {
    const mrn = await issueMrn(db, ctx.tenantId);
    const { keyRef, values } = await cipher.encryptRecord(
      { phone },
      { tenantId: ctx.tenantId, recordId: id },
    );
    await insertPatient(db, {
      id,
      tenantId: ctx.tenantId,
      mrn,
      nameGiven,
      nameFamily: "Synthetic",
      gender: "female",
      birthDate: "1990-01-15",
      phoneEnc: values.phone,
      phoneBidx: bidx("phone", ctx.tenantId, phone),
      encKeyRef: keyRef,
    });
  });
  return id;
}

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

describe("patient encryption + persistence (TDR-0003, DDR-0006)", () => {
  it("identifiers are CIPHERTEXT at rest and decrypt back through the envelope", async () => {
    const id = await insertEncryptedPatient(A, "Meera", PHONE);

    // Raw row inspection as superuser: plaintext must not exist anywhere.
    const admin = new Client({ connectionString: env.migratorUrl });
    await admin.connect();
    const { rows } = await admin.query(
      "SELECT phone_enc, enc_key_ref, encode(phone_enc,'escape') AS raw FROM clinical.patient WHERE id = $1",
      [id],
    );
    await admin.end();
    expect(rows[0].phone_enc).toBeInstanceOf(Buffer);
    expect(String(rows[0].raw)).not.toContain("98765");
    expect(rows[0].enc_key_ref).toMatch(/^local\./);

    // Round-trip decrypt through the same envelope.
    const row = await withTenantContext(appPool, A, (db) => getPatientById(db, id));
    const plain = await cipher.decryptRecord(
      row!.encKeyRef!,
      { phone: row!.phoneEnc },
      { tenantId: A.tenantId, recordId: id },
    );
    expect(plain.phone).toBe(PHONE);
  });

  it("blind-index lookup finds the patient WITHOUT decryption (tenant-scoped)", async () => {
    const found = await withTenantContext(appPool, A, (db) =>
      findPatientByBlindIndex(db, "phone", bidx("phone", A.tenantId, "98765 00001")),
    );
    expect(found).toBeDefined();
    expect(found!.nameGiven).toBe("Meera");
  });

  it("trigram search matches partial names", async () => {
    const rows = await withTenantContext(appPool, A, (db) => searchPatientsByText(db, "eer", 10));
    expect(rows.some((r) => r.nameGiven === "Meera")).toBe(true);
  });

  it("optimistic concurrency: stale version updates nothing (DDR-0009 → 409)", async () => {
    const id = await insertEncryptedPatient(A, "Ravi", "+919876500002");
    await withTenantContext(appPool, A, async (db) => {
      const fresh = await updatePatientVersioned(db, id, 0, { nameGiven: "Ravi Kumar" });
      expect(fresh?.version).toBe(1);
      const stale = await updatePatientVersioned(db, id, 0, { nameGiven: "Hijack" });
      expect(stale).toBeUndefined();
    });
  });

  it("idempotency keys persist in-tenant and replay to the original resource", async () => {
    const id = await insertEncryptedPatient(A, "Kiran", "+919876500003");
    await withTenantContext(appPool, A, (db) =>
      saveIdempotencyKey(db, {
        tenantId: A.tenantId,
        endpoint: "POST /v1/patients",
        key: "itest-key-1",
        resourceId: id,
      }),
    );
    const replay = await withTenantContext(appPool, A, (db) =>
      findIdempotentResource(db, "POST /v1/patients", "itest-key-1"),
    );
    expect(replay).toBe(id);
    // Another tenant cannot see (or collide with) the key: RLS.
    const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };
    const foreign = await withTenantContext(appPool, B, (db) =>
      findIdempotentResource(db, "POST /v1/patients", "itest-key-1"),
    );
    expect(foreign).toBeUndefined();
  });

  it("concurrent MRN issuance yields unique values (decision S2-c)", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        withTenantContext(appPool, A, (db) => issueMrn(db, A.tenantId)),
      ),
    );
    expect(new Set(results).size).toBe(20);
    expect(results.every((m) => /^MRN-\d{6}$/.test(m))).toBe(true);
  });
});
