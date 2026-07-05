/**
 * Stage 1 integration suite (TDR-0003): real Postgres, real RLS, app role.
 * Verifies the Core Platform invariants the exit criteria depend on:
 * tenant-scoped referential integrity (DDR-0008), duplicate-safe natural
 * keys (clarification #3), and idempotent replays.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignRoleIdempotent,
  createAppPool,
  ensureTenantRoles,
  findActiveUserByKeycloakSub,
  findRoleByCode,
  insertDepartment,
  insertFacility,
  insertOrganization,
  insertTenantIdempotent,
  isForeignKeyViolation,
  isUniqueViolation,
  newId,
  SEED,
  withTenantContext,
} from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;
let orgA: string;
let facilityA: string;

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);
  await withTenantContext(appPool, A, async (db) => {
    const org = await insertOrganization(db, {
      id: newId(),
      tenantId: SEED.tenantA,
      name: "Integration Hospital (synthetic)",
      type: "hospital",
    });
    orgA = org.id;
    const fac = await insertFacility(db, {
      id: newId(),
      tenantId: SEED.tenantA,
      organizationId: orgA,
      name: "Main Campus",
      timezone: "Asia/Kolkata",
    });
    facilityA = fac.id;
  });
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

describe("core platform integration (TDR-0003)", () => {
  it("tenant-scoped composite FK: B cannot attach a facility to A's organization (DDR-0008)", async () => {
    let caught: unknown;
    await withTenantContext(appPool, B, async (db) => {
      try {
        await insertFacility(db, {
          id: newId(),
          tenantId: SEED.tenantB,
          organizationId: orgA, // another tenant's parent
          name: "Cross-tenant graft",
          timezone: "Asia/Kolkata",
        });
      } catch (err) {
        caught = err;
      }
    }).catch((err: unknown) => {
      caught = caught ?? err;
    });
    expect(caught).toBeDefined();
    expect(isForeignKeyViolation(caught)).toBe(true);
  });

  it("duplicate department code within a facility is rejected (duplicate-safe)", async () => {
    await withTenantContext(appPool, A, async (db) => {
      await insertDepartment(db, {
        id: newId(),
        tenantId: SEED.tenantA,
        facilityId: facilityA,
        name: "OPD General",
        code: "OPD-DUP",
      });
    });
    let caught: unknown;
    await withTenantContext(appPool, A, async (db) => {
      await insertDepartment(db, {
        id: newId(),
        tenantId: SEED.tenantA,
        facilityId: facilityA,
        name: "OPD General (again)",
        code: "OPD-DUP",
      });
    }).catch((err: unknown) => {
      caught = err;
    });
    expect(isUniqueViolation(caught)).toBe(true);
  });

  it("tenant creation is idempotent on id+slug replay", async () => {
    const id = newId();
    const first = await withTenantContext(appPool, { tenantId: id, actorId: id }, (db) =>
      insertTenantIdempotent(db, { id, slug: "replay-clinic", name: "Replay Clinic" }),
    );
    const second = await withTenantContext(appPool, { tenantId: id, actorId: id }, (db) =>
      insertTenantIdempotent(db, { id, slug: "replay-clinic", name: "Replay Clinic" }),
    );
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.tenant.id).toBe(id);
  });

  it("role assignment replay is a no-op (single row)", async () => {
    const doctor = await withTenantContext(appPool, A, async (db) => {
      const user = await findActiveUserByKeycloakSub(db, SEED.keycloak.doctorA);
      const role = await findRoleByCode(db, "nurse");
      if (!user || !role) throw new Error("seed missing fixtures");
      await assignRoleIdempotent(db, { tenantId: SEED.tenantA, userId: user.id, roleId: role.id });
      await assignRoleIdempotent(db, { tenantId: SEED.tenantA, userId: user.id, roleId: role.id });
      return user.id;
    });
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [SEED.tenantA]);
      const { rows } = await client.query(
        `SELECT count(*) AS n FROM platform.user_role ur
           JOIN platform.role r ON r.id = ur.role_id
          WHERE ur.user_id = $1 AND r.code = 'nurse'`,
        [doctor],
      );
      await client.query("COMMIT");
      expect(Number((rows[0] as { n: string }).n)).toBe(1);
    } finally {
      client.release();
    }
  });

  it("new tenants get the full default role set (idempotently)", async () => {
    const id = newId();
    const roles = await withTenantContext(appPool, { tenantId: id, actorId: id }, async (db) => {
      await insertTenantIdempotent(db, { id, slug: "roles-clinic", name: "Roles Clinic" });
      await ensureTenantRoles(db, id, ["admin", "doctor", "nurse", "front_desk"]);
      return ensureTenantRoles(db, id, ["admin", "doctor", "nurse", "front_desk"]); // replay
    });
    expect([...roles.keys()].sort()).toEqual(["admin", "doctor", "front_desk", "nurse"]);
  });
});
