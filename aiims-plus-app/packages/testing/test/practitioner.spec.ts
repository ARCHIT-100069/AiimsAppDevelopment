/**
 * Stage 3 integration suite (TDR-0003): the practitioner directory against a
 * real Postgres as `aiims_app`. Proves the Stage 3 guarantees end-to-end:
 *   - tenant-scoped composite FK integrity (DDR-0008): a practitioner can only
 *     link an app_user / department that lives in the SAME tenant;
 *   - duplicate registration number → unique violation → 409 upstream;
 *   - the app_user link is IMMUTABLE (the versioned update never touches it);
 *   - optimistic concurrency (DDR-0009): stale version updates nothing;
 *   - the non-blocking role-warning signal (decision i): a practitioner may be
 *     created for a non-clinical user, and roleCodesForAppUser reflects that.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignRoleIdempotent,
  createAppPool,
  findPractitionerByRegistration,
  findRoleByCode,
  getAppUserDisplayName,
  getPractitionerById,
  insertAppUser,
  insertPractitioner,
  isForeignKeyViolation,
  isUniqueViolation,
  newId,
  roleCodesForAppUser,
  SEED,
  updatePractitionerVersioned,
  withTenantContext,
} from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };

/** Create an app_user under `ctx`, optionally granting one role. Returns its id. */
async function makeUser(
  ctx: typeof A,
  displayName: string,
  roleCode?: "doctor" | "nurse" | "admin" | "front_desk",
): Promise<string> {
  const id = newId();
  await withTenantContext(appPool, ctx, async (db) => {
    await insertAppUser(db, {
      id,
      tenantId: ctx.tenantId,
      keycloakSub: newId(),
      displayName,
    });
    if (roleCode) {
      const role = await findRoleByCode(db, roleCode);
      await assignRoleIdempotent(db, { tenantId: ctx.tenantId, userId: id, roleId: role!.id });
    }
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

describe("practitioner directory (TDR-0003, DDR-0008/0009, decision i)", () => {
  it("links an app_user and defaults its name; getAppUserDisplayName backs decision c", async () => {
    const userId = await makeUser(A, "Dr. Asha Rao", "doctor");
    const id = newId();
    await withTenantContext(appPool, A, async (db) => {
      expect(await getAppUserDisplayName(db, userId)).toBe("Dr. Asha Rao");
      await insertPractitioner(db, {
        id,
        tenantId: A.tenantId,
        appUserId: userId,
        nameGiven: "Asha",
        nameFamily: "Rao",
        registrationNo: "MCI-A-1001",
        specialties: [{ system: "specialty", code: "cardiology", display: "Cardiology" }],
      });
    });
    const row = await withTenantContext(appPool, A, (db) => getPractitionerById(db, id));
    expect(row?.appUserId).toBe(userId);
    expect(row?.registrationNo).toBe("MCI-A-1001");
    expect(row?.version).toBe(0);
  });

  it("composite FK (DDR-0008): cannot link an app_user from ANOTHER tenant", async () => {
    const userB = await makeUser(B, "Dr. Bala", "doctor");
    // Under A's context, RLS hides B's user AND the tenant-scoped FK has no
    // (A.tenant_id, userB) pair to satisfy → foreign-key violation.
    await withTenantContext(appPool, A, async (db) => {
      let caught: unknown;
      try {
        await insertPractitioner(db, {
          id: newId(),
          tenantId: A.tenantId,
          appUserId: userB,
          nameGiven: "Graft",
          nameFamily: "Attempt",
          registrationNo: "MCI-A-GRAFT",
          specialties: [],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      expect(isForeignKeyViolation(caught)).toBe(true);
    });
  });

  it("duplicate registration number in-tenant → unique violation → 409", async () => {
    const u1 = await makeUser(A, "Reg One", "nurse");
    const u2 = await makeUser(A, "Reg Two", "nurse");
    await withTenantContext(appPool, A, (db) =>
      insertPractitioner(db, {
        id: newId(),
        tenantId: A.tenantId,
        appUserId: u1,
        nameGiven: "Reg",
        nameFamily: "One",
        registrationNo: "MCI-A-DUP",
        specialties: [],
      }),
    );
    await withTenantContext(appPool, A, async (db) => {
      let caught: unknown;
      try {
        await insertPractitioner(db, {
          id: newId(),
          tenantId: A.tenantId,
          appUserId: u2,
          nameGiven: "Reg",
          nameFamily: "Two",
          registrationNo: "MCI-A-DUP",
          specialties: [],
        });
      } catch (err) {
        caught = err;
      }
      expect(isUniqueViolation(caught)).toBe(true);
    });
    // The SAME registration number is free in a DIFFERENT tenant (tenant-scoped unique).
    const userB = await makeUser(B, "B Reg", "doctor");
    const bId = newId();
    await withTenantContext(appPool, B, (db) =>
      insertPractitioner(db, {
        id: bId,
        tenantId: B.tenantId,
        appUserId: userB,
        nameGiven: "B",
        nameFamily: "Reg",
        registrationNo: "MCI-A-DUP",
        specialties: [],
      }),
    );
    const found = await withTenantContext(appPool, B, (db) =>
      findPractitionerByRegistration(db, "MCI-A-DUP"),
    );
    expect(found?.id).toBe(bId);
  });

  it("app_user link is IMMUTABLE: the versioned update changes names/status but never the user", async () => {
    const userId = await makeUser(A, "Immutable Link", "doctor");
    const id = newId();
    await withTenantContext(appPool, A, (db) =>
      insertPractitioner(db, {
        id,
        tenantId: A.tenantId,
        appUserId: userId,
        nameGiven: "Old",
        nameFamily: "Name",
        registrationNo: "MCI-A-IMMUT",
        specialties: [],
      }),
    );
    const updated = await withTenantContext(appPool, A, (db) =>
      updatePractitionerVersioned(db, id, 0, { nameGiven: "New", status: "inactive" }),
    );
    expect(updated?.version).toBe(1);
    expect(updated?.nameGiven).toBe("New");
    expect(updated?.status).toBe("inactive");
    // The link is untouched — there is no code path that can reassign it.
    expect(updated?.appUserId).toBe(userId);

    // Optimistic concurrency (DDR-0009): the stale version now updates nothing.
    const stale = await withTenantContext(appPool, A, (db) =>
      updatePractitionerVersioned(db, id, 0, { nameGiven: "Hijack" }),
    );
    expect(stale).toBeUndefined();
  });

  it("non-blocking role warning (decision i): a non-clinical user can back a practitioner", async () => {
    const frontDeskUser = await makeUser(A, "Front Desk Clerk", "front_desk");
    const roles = await withTenantContext(appPool, A, (db) =>
      roleCodesForAppUser(db, frontDeskUser),
    );
    expect(roles).toEqual(["front_desk"]);
    expect(roles.some((r) => r === "doctor" || r === "nurse")).toBe(false);
    // Creation is NOT blocked — the row persists; the service layer emits the warning.
    const id = newId();
    await withTenantContext(appPool, A, (db) =>
      insertPractitioner(db, {
        id,
        tenantId: A.tenantId,
        appUserId: frontDeskUser,
        nameGiven: "Front",
        nameFamily: "Desk",
        registrationNo: "MCI-A-WARN",
        specialties: [],
      }),
    );
    const row = await withTenantContext(appPool, A, (db) => getPractitionerById(db, id));
    expect(row?.id).toBe(id);
  });
});
