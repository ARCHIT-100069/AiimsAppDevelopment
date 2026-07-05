/**
 * THE CROSS-TENANT ISOLATION GATE — TDR-0006 / DATABASE-ARCHITECTURE §17.
 *
 * "The single most important test in the repository." Merge-blocking.
 * Stage 1: probes target the Core Platform tables (organization/facility/
 * department) — the note proof table is retired.
 *
 * Runs as the `aiims_app` role against a REAL PostgreSQL so FORCE RLS is
 * exercised exactly as in production:
 *   1. under tenant A, every access pattern against tenant B's rows
 *      (select by id, list, update, join, jsonb path, text search) returns
 *      zero rows / affects nothing;
 *   2. writing tenant B's tenant_id under A is rejected (WITH CHECK);
 *   3. unset tenant context yields zero rows (fail-closed);
 *   4. the audit log is append-only for the app role;
 *   5. GUARDRAIL (ADR-0011/DDR-0011): if RLS enforcement is turned off, this
 *      suite's leak detector DOES observe the leak — proving a silent
 *      policy/RLS drop cannot pass CI — and the policy-diff check reports it.
 */
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkRlsPolicies,
  createAppPool,
  insertDepartment,
  insertFacility,
  insertOrganization,
  insertOutboxEvent,
  newId,
  SEED,
  withTenantContext,
} from "@aiims/db";
import { computeBlindIndex, FieldCipher, LocalKeyProvider } from "@aiims/crypto";
import { insertPatient, issueMrn } from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;
let deptB: string;
let patientB: string;

const kp = new LocalKeyProvider("3".repeat(64), "4".repeat(64), "test");
const patientCipher = new FieldCipher(kp);
const SHARED_PHONE = "+919999900000"; // deliberately identical in A and B

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };

/** Build org → facility → department under one tenant's own context. */
async function buildHierarchy(ctx: typeof A, marker: string): Promise<string> {
  return withTenantContext(appPool, ctx, async (db) => {
    const org = await insertOrganization(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      name: `Hospital ${marker}`,
      type: "hospital",
    });
    const fac = await insertFacility(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      organizationId: org.id,
      name: `Campus ${marker}`,
      timezone: "Asia/Kolkata",
    });
    const dept = await insertDepartment(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      facilityId: fac.id,
      name: `OPD ${marker}`,
      code: "OPD-GEN",
    });
    return dept.id;
  });
}

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);
  await buildHierarchy(A, "tenant-a (synthetic)"); // A-side fixtures for list/leak probes
  deptB = await buildHierarchy(B, "tenant-b-secret (synthetic)");
  await seedPatient(A, "Asha");
  patientB = await seedPatient(B, "Tenant-B-Secret-Patient");
}, 180_000);

/** Patient with an ENCRYPTED phone — same value in both tenants on purpose. */
async function seedPatient(ctx: typeof A, nameGiven: string): Promise<string> {
  const id = newId();
  await withTenantContext(appPool, ctx, async (db) => {
    const mrn = await issueMrn(db, ctx.tenantId);
    const { keyRef, values } = await patientCipher.encryptRecord(
      { phone: SHARED_PHONE },
      { tenantId: ctx.tenantId, recordId: id },
    );
    await insertPatient(db, {
      id,
      tenantId: ctx.tenantId,
      mrn,
      nameGiven,
      nameFamily: "Synthetic",
      gender: "other",
      birthDate: "1985-05-05",
      phoneEnc: values.phone,
      phoneBidx: computeBlindIndex(kp.indexKey(), ctx.tenantId, "phone", SHARED_PHONE),
      encKeyRef: keyRef,
    });
  });
  return id;
}

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

/** Raw leak probe: how many of B's departments can A see? */
async function countBDepartmentsVisibleUnderA(): Promise<number> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM platform.department WHERE tenant_id = $1",
      [SEED.tenantB],
    );
    await client.query("COMMIT");
    return Number(rows[0]!.n);
  } finally {
    client.release();
  }
}

async function underA<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
    const { rows } = await client.query(query, params);
    await client.query("COMMIT");
    return rows as T[];
  } finally {
    client.release();
  }
}

describe("cross-tenant isolation gate (TDR-0006) — runs as aiims_app under FORCE RLS", () => {
  it("direct id lookup: A cannot read B's department", async () => {
    expect(await underA("SELECT id FROM platform.department WHERE id = $1", [deptB])).toHaveLength(
      0,
    );
  });

  it("list scan: A sees only A's organizations", async () => {
    const rows = await withTenantContext(appPool, A, (db) => db.query.organization.findMany());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === SEED.tenantA)).toBe(true);
  });

  it("UPDATE: A cannot modify B's department (0 rows affected)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const res = await client.query(
        "UPDATE platform.department SET name = 'hijacked' WHERE id = $1",
        [deptB],
      );
      await client.query("ROLLBACK");
      expect(res.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it("JOIN: A cannot reach B's rows through facility→organization joins", async () => {
    const rows = await underA(
      `SELECT d.id FROM platform.department d
         JOIN platform.facility f ON f.id = d.facility_id
         JOIN platform.organization o ON o.id = f.organization_id
        WHERE o.name ILIKE '%tenant-b%'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("jsonb path: A cannot read B's outbox payloads", async () => {
    await withTenantContext(appPool, B, async (db) => {
      await insertOutboxEvent(db, {
        id: newId(),
        tenantId: SEED.tenantB,
        aggregateType: "department",
        aggregateId: deptB,
        eventType: "department.created.v1",
        payload: { departmentId: deptB, marker: "tenant-b-payload" },
      });
    });
    const rows = await underA(
      "SELECT id FROM platform.outbox WHERE payload->>'marker' = 'tenant-b-payload'",
    );
    expect(rows).toHaveLength(0);
  });

  it("text search: A cannot find B's department by name", async () => {
    expect(
      await underA("SELECT id FROM platform.department WHERE name ILIKE '%tenant-b-secret%'"),
    ).toHaveLength(0);
  });

  it("WITH CHECK: writing B's tenant_id under A's context is rejected", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      await expect(
        client.query(
          "INSERT INTO platform.organization (id, tenant_id, name, type) VALUES ($1, $2, $3, 'clinic')",
          [newId(), SEED.tenantB /* forged tenant id */, "cross-tenant forgery attempt"],
        ),
      ).rejects.toThrow(/row-level security/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("fail-closed: unset tenant context sees zero rows", async () => {
    const client = await appPool.connect();
    try {
      const { rows } = await client.query("SELECT count(*) AS n FROM platform.department");
      expect(Number((rows[0] as { n: string }).n)).toBe(0);
    } finally {
      client.release();
    }
  });

  it("audit log is append-only for the app role (UPDATE/DELETE denied)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      await expect(client.query("UPDATE audit.audit_log SET action = 'tampered'")).rejects.toThrow(
        /permission denied/,
      );
      await client.query("ROLLBACK");
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      await expect(client.query("DELETE FROM audit.audit_log")).rejects.toThrow(
        /permission denied/,
      );
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("reference data is read-only for the app role (DDR-0012)", async () => {
    const client = await appPool.connect();
    try {
      const { rows } = await client.query("SELECT count(*) AS n FROM reference.code");
      expect(Number((rows[0] as { n: string }).n)).toBeGreaterThan(0); // globally readable
      await expect(
        client.query(
          "INSERT INTO reference.code (system, code, display) VALUES ('icd-10', 'X99', 'nope')",
        ),
      ).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  it("PATIENT: A cannot reach B's patient by id, name search, or blind index", async () => {
    expect(await underA("SELECT id FROM clinical.patient WHERE id = $1", [patientB])).toHaveLength(
      0,
    );
    expect(
      await underA("SELECT id FROM clinical.patient WHERE name_given ILIKE '%tenant-b-secret%'"),
    ).toHaveLength(0);
    // Even holding B's exact digest (B's tenant salt), RLS returns nothing under A...
    const bDigest = computeBlindIndex(kp.indexKey(), SEED.tenantB, "phone", SHARED_PHONE);
    expect(
      await underA("SELECT id FROM clinical.patient WHERE phone_bidx = $1", [bDigest]),
    ).toHaveLength(0);
    // ...and A's own salt over the SAME phone produces a DIFFERENT digest (S2-f),
    // so no cross-tenant equality correlation exists even without RLS.
    const aDigest = computeBlindIndex(kp.indexKey(), SEED.tenantA, "phone", SHARED_PHONE);
    expect(aDigest.equals(bDigest)).toBe(false);
  });

  it("PATIENT: writing B's tenant_id under A is rejected (WITH CHECK)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      await expect(
        client.query(
          `INSERT INTO clinical.patient (id, tenant_id, mrn, name_given, name_family, gender, birth_date)
           VALUES ($1, $2, 'MRN-FORGED', 'X', 'Y', 'other', '1990-01-01')`,
          [newId(), SEED.tenantB],
        ),
      ).rejects.toThrow(/row-level security/);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("policy manifest is clean on a freshly migrated database (DDR-0011 gate)", async () => {
    expect(await checkRlsPolicies(env.migratorUrl)).toEqual([]);
  });

  it("GUARDRAIL: disabling RLS enforcement IS detected by this suite and the policy gate", async () => {
    const admin = new Client({ connectionString: env.migratorUrl });
    await admin.connect();
    try {
      expect(await countBDepartmentsVisibleUnderA()).toBe(0);

      // Simulate the drizzle-kit footgun: RLS enforcement silently removed.
      await admin.query("ALTER TABLE platform.department NO FORCE ROW LEVEL SECURITY");
      await admin.query("ALTER TABLE platform.department DISABLE ROW LEVEL SECURITY");

      expect(await countBDepartmentsVisibleUnderA()).toBeGreaterThan(0); // leak observed
      const problems = await checkRlsPolicies(env.migratorUrl);
      expect(problems.some((p) => p.includes("platform.department"))).toBe(true);
    } finally {
      await admin.query("ALTER TABLE platform.department ENABLE ROW LEVEL SECURITY");
      await admin.query("ALTER TABLE platform.department FORCE ROW LEVEL SECURITY");
      await admin.end();
    }
    expect(await countBDepartmentsVisibleUnderA()).toBe(0);
    expect(await checkRlsPolicies(env.migratorUrl)).toEqual([]);
  });
});
