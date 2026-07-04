/**
 * THE CROSS-TENANT ISOLATION GATE — TDR-0006 / DATABASE-ARCHITECTURE §17.
 *
 * "The single most important test in the repository." Merge-blocking.
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
import { checkRlsPolicies, createAppPool, newId, SEED, withTenantContext } from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;
let userA: string; // app_user.id of doctor in tenant A
let userB: string;
let noteA: string;
let noteB: string;

const A = { tenantId: SEED.tenantA, actorId: "" };
const B = { tenantId: SEED.tenantB, actorId: "" };

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);

  // Resolve seeded users under each tenant's own context (as the app would).
  userA = await withTenantContext(
    appPool,
    { tenantId: SEED.tenantA, actorId: SEED.tenantA },
    async (db) => {
      const rows = await db.query.appUser.findMany();
      const doctor = rows.find((r) => r.keycloakSub === SEED.keycloak.doctorA);
      if (!doctor) throw new Error("seed missing doctor A");
      return doctor.id;
    },
  );
  userB = await withTenantContext(
    appPool,
    { tenantId: SEED.tenantB, actorId: SEED.tenantB },
    async (db) => {
      const rows = await db.query.appUser.findMany();
      const doctor = rows.find((r) => r.keycloakSub === SEED.keycloak.doctorB);
      if (!doctor) throw new Error("seed missing doctor B");
      return doctor.id;
    },
  );
  A.actorId = userA;
  B.actorId = userB;

  // Fixture notes, written by each tenant under its own context.
  noteA = newId();
  await withTenantContext(appPool, A, async (db) => {
    await db.insert((await import("@aiims/db")).schema.note).values({
      id: noteA,
      tenantId: SEED.tenantA,
      authorId: userA,
      body: "note for tenant-a only (synthetic)",
    });
  });
  noteB = newId();
  await withTenantContext(appPool, B, async (db) => {
    await db.insert((await import("@aiims/db")).schema.note).values({
      id: noteB,
      tenantId: SEED.tenantB,
      authorId: userB,
      body: "note for tenant-b only (synthetic)",
    });
  });
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

/** Raw leak probe used by several tests: how many of B's notes can A see? */
async function countBNotesVisibleUnderA(): Promise<number> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
    const { rows } = await client.query<{ n: string }>(
      "SELECT count(*) AS n FROM platform.note WHERE tenant_id = $1",
      [SEED.tenantB],
    );
    await client.query("COMMIT");
    return Number(rows[0]!.n);
  } finally {
    client.release();
  }
}

describe("cross-tenant isolation gate (TDR-0006) — runs as aiims_app under FORCE RLS", () => {
  it("direct id lookup: A cannot read B's note", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const { rows } = await client.query("SELECT id FROM platform.note WHERE id = $1", [noteB]);
      await client.query("COMMIT");
      expect(rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("list scan: A sees only A's notes", async () => {
    const rows = await withTenantContext(appPool, A, async (db) => db.query.note.findMany());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === SEED.tenantA)).toBe(true);
  });

  it("UPDATE: A cannot modify B's note (0 rows affected)", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const res = await client.query("UPDATE platform.note SET body = 'hijacked' WHERE id = $1", [
        noteB,
      ]);
      await client.query("ROLLBACK");
      expect(res.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it("JOIN: A cannot reach B's rows through app_user joins", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const { rows } = await client.query(
        `SELECT n.id FROM platform.note n
           JOIN platform.app_user u ON u.id = n.author_id
          WHERE u.keycloak_sub = $1`,
        [SEED.keycloak.doctorB],
      );
      await client.query("COMMIT");
      expect(rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("jsonb path: A cannot read B's outbox payloads", async () => {
    // Write an outbox row for B under B's context first.
    await withTenantContext(appPool, B, async (db) => {
      const { outbox } = (await import("@aiims/db")).schema;
      await db.insert(outbox).values({
        id: newId(),
        tenantId: SEED.tenantB,
        aggregateType: "note",
        aggregateId: noteB,
        eventType: "note.created.v1",
        payload: { noteId: noteB, marker: "tenant-b-payload" },
      });
    });
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const { rows } = await client.query(
        "SELECT id FROM platform.outbox WHERE payload->>'marker' = 'tenant-b-payload'",
      );
      await client.query("COMMIT");
      expect(rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("text search: A cannot find B's note by content", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const { rows } = await client.query(
        "SELECT id FROM platform.note WHERE body ILIKE '%tenant-b%'",
      );
      await client.query("COMMIT");
      expect(rows).toHaveLength(0);
    } finally {
      client.release();
    }
  });

  it("WITH CHECK: writing B's tenant_id under A's context is rejected", async () => {
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      await expect(
        client.query(
          "INSERT INTO platform.note (id, tenant_id, author_id, body) VALUES ($1, $2, $3, $4)",
          [newId(), SEED.tenantB /* forged tenant id */, userB, "cross-tenant forgery attempt"],
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
      const { rows } = await client.query("SELECT count(*) AS n FROM platform.note");
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

  it("policy manifest is clean on a freshly migrated database (DDR-0011 gate)", async () => {
    expect(await checkRlsPolicies(env.migratorUrl)).toEqual([]);
  });

  it("GUARDRAIL: disabling RLS enforcement IS detected by this suite and the policy gate", async () => {
    const admin = new Client({ connectionString: env.migratorUrl });
    await admin.connect();
    try {
      // Baseline: isolated.
      expect(await countBNotesVisibleUnderA()).toBe(0);

      // Simulate the drizzle-kit footgun: RLS enforcement silently removed.
      await admin.query("ALTER TABLE platform.note NO FORCE ROW LEVEL SECURITY");
      await admin.query("ALTER TABLE platform.note DISABLE ROW LEVEL SECURITY");

      // The leak detector must OBSERVE the breach (this is what makes the
      // gate meaningful: a policy drop cannot pass silently)...
      expect(await countBNotesVisibleUnderA()).toBeGreaterThan(0);
      // ...and the policy-diff check must report the regression.
      const problems = await checkRlsPolicies(env.migratorUrl);
      expect(problems.some((p) => p.includes("platform.note"))).toBe(true);
    } finally {
      // Restore enforcement and prove isolation again.
      await admin.query("ALTER TABLE platform.note ENABLE ROW LEVEL SECURITY");
      await admin.query("ALTER TABLE platform.note FORCE ROW LEVEL SECURITY");
      await admin.end();
    }
    expect(await countBNotesVisibleUnderA()).toBe(0);
    expect(await checkRlsPolicies(env.migratorUrl)).toEqual([]);
  });
});
