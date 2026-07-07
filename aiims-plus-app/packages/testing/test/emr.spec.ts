/**
 * Stage 5 integration suite (TDR-0003): EMR against a real Postgres as
 * `aiims_app`. Proves the Stage 5 guarantees end-to-end:
 *   - note amendments create a RETAINED new version (append-only, DDR-0013);
 *   - signing FREEZES the encounter — the DB status guard blocks further
 *     chief-complaint edits (defence in depth behind the service rule);
 *   - order → result composite-FK integrity, and cross-tenant grafts rejected
 *     (DDR-0008);
 *   - optimistic concurrency (a stale sign updates nothing, DDR-0009).
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignRoleIdempotent,
  createAppPool,
  findRoleByCode,
  getLatestNoteVersion,
  getNoteById,
  insertAppUser,
  insertAppointment,
  insertCondition,
  insertDiagnosticReport,
  insertEncounter,
  insertFacility,
  insertNote,
  insertObservation,
  insertOrganization,
  insertPatient,
  insertPractitioner,
  insertServiceRequest,
  isForeignKeyViolation,
  issueMrn,
  listLatestNotesByEncounter,
  newId,
  SEED,
  signEncounterVersioned,
  updateEncounterChiefComplaint,
  withTenantContext,
} from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };

interface Fx {
  encounterId: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
}

async function expectRejection(fn: () => Promise<unknown>, predicate: (e: unknown) => boolean) {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeDefined();
  expect(predicate(caught)).toBe(true);
}

/** Build org → facility → patient → practitioner → appointment → encounter. */
async function seed(ctx: typeof A, marker: string): Promise<Fx> {
  return withTenantContext(appPool, ctx, async (db) => {
    const org = await insertOrganization(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      name: `Hosp ${marker}`,
      type: "hospital",
    });
    const fac = await insertFacility(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      organizationId: org.id,
      name: `Campus ${marker}`,
      timezone: "Asia/Kolkata",
    });
    const patientId = newId();
    await insertPatient(db, {
      id: patientId,
      tenantId: ctx.tenantId,
      mrn: await issueMrn(db, ctx.tenantId),
      nameGiven: "Emr",
      nameFamily: marker,
      gender: "other",
      birthDate: "1990-01-01",
    });
    const userId = newId();
    await insertAppUser(db, {
      id: userId,
      tenantId: ctx.tenantId,
      keycloakSub: newId(),
      displayName: `Dr ${marker}`,
    });
    const role = await findRoleByCode(db, "doctor");
    await assignRoleIdempotent(db, { tenantId: ctx.tenantId, userId, roleId: role!.id });
    const practitionerId = newId();
    await insertPractitioner(db, {
      id: practitionerId,
      tenantId: ctx.tenantId,
      appUserId: userId,
      nameGiven: "Doc",
      nameFamily: marker,
      registrationNo: `REG-EMR-${marker}`,
      specialties: [],
    });
    const appt = await insertAppointment(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      patientId,
      practitionerId,
      facilityId: fac.id,
      startAt: new Date("2026-11-01T04:00:00.000Z"),
      endAt: new Date("2026-11-01T04:15:00.000Z"),
      appointmentType: "routine",
      specialties: [],
      priority: 0,
    });
    const encounterId = newId();
    await insertEncounter(db, {
      id: encounterId,
      tenantId: ctx.tenantId,
      appointmentId: appt.id,
      patientId,
      practitionerId,
      facilityId: fac.id,
    });
    return { encounterId, patientId, practitionerId, facilityId: fac.id };
  });
}

let fx: Fx;

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);
  fx = await seed(A, "a");
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

describe("EMR (TDR-0003, DDR-0008/0009/0013)", () => {
  it("note amendment creates a RETAINED new version (append-only, DDR-0013)", async () => {
    const noteId = newId();
    const v1 = await withTenantContext(appPool, A, (db) =>
      insertNote(db, {
        id: newId(),
        tenantId: A.tenantId,
        encounterId: fx.encounterId,
        noteId,
        version: 1,
        noteType: "progress",
        body: "initial impression",
        authorId: fx.practitionerId,
      }),
    );
    const v2 = await withTenantContext(appPool, A, (db) =>
      insertNote(db, {
        id: newId(),
        tenantId: A.tenantId,
        encounterId: fx.encounterId,
        noteId,
        version: 2,
        supersedesId: v1.id,
        noteType: "progress",
        body: "corrected impression",
        authorId: fx.practitionerId,
        amendmentReason: "clarified findings",
      }),
    );
    // Both versions are retained; latest is v2; the list shows only the latest.
    expect(await withTenantContext(appPool, A, (db) => getNoteById(db, v1.id))).toBeDefined();
    const latest = await withTenantContext(appPool, A, (db) => getLatestNoteVersion(db, noteId));
    expect(latest?.id).toBe(v2.id);
    expect(latest?.version).toBe(2);
    expect(latest?.supersedesId).toBe(v1.id);
    const list = await withTenantContext(appPool, A, (db) =>
      listLatestNotesByEncounter(db, fx.encounterId),
    );
    expect(list.filter((n) => n.noteId === noteId)).toHaveLength(1);
  });

  it("signing freezes the encounter — the DB status guard blocks later edits", async () => {
    const signed = await withTenantContext(appPool, A, (db) =>
      signEncounterVersioned(db, fx.encounterId, 0, fx.practitionerId),
    );
    expect(signed?.status).toBe("finished");
    expect(signed?.signedBy).toBe(fx.practitionerId);
    expect(signed?.signedAt).not.toBeNull();
    // Chief-complaint edit requires status='in_progress' ⇒ now a no-op.
    const late = await withTenantContext(appPool, A, (db) =>
      updateEncounterChiefComplaint(db, fx.encounterId, signed!.version, "too late"),
    );
    expect(late).toBeUndefined();
  });

  it("optimistic concurrency: a stale sign updates nothing (DDR-0009)", async () => {
    const other = await seed(A, "concurrency");
    const first = await withTenantContext(appPool, A, (db) =>
      signEncounterVersioned(db, other.encounterId, 0, other.practitionerId),
    );
    expect(first?.version).toBe(1);
    const stale = await withTenantContext(appPool, A, (db) =>
      signEncounterVersioned(db, other.encounterId, 0, other.practitionerId),
    );
    expect(stale).toBeUndefined();
  });

  it("order → result composite FK holds in-tenant and rejects cross-tenant grafts (DDR-0008)", async () => {
    const order = await withTenantContext(appPool, A, (db) =>
      insertServiceRequest(db, {
        id: newId(),
        tenantId: A.tenantId,
        encounterId: fx.encounterId,
        patientId: fx.patientId,
        code: { system: "loinc", code: "718-7", display: "Hemoglobin" },
        priority: "routine",
        requesterId: fx.practitionerId,
      }),
    );
    await withTenantContext(appPool, A, (db) =>
      insertDiagnosticReport(db, {
        id: newId(),
        tenantId: A.tenantId,
        serviceRequestId: order.id,
        encounterId: fx.encounterId,
        patientId: fx.patientId,
        status: "final",
        conclusion: "Hb 13.4 g/dL",
        filedBy: fx.practitionerId,
      }),
    );
    // Tenant B files a result against A's order ⇒ composite FK has no B-row ⇒ rejected.
    const b = await seed(B, "b");
    await expectRejection(
      () =>
        withTenantContext(appPool, B, (db) =>
          insertDiagnosticReport(db, {
            id: newId(),
            tenantId: B.tenantId,
            serviceRequestId: order.id, // A's order under B
            encounterId: b.encounterId,
            patientId: b.patientId,
            status: "final",
            conclusion: "graft",
            filedBy: b.practitionerId,
          }),
        ),
      isForeignKeyViolation,
    );
  });

  it("cross-tenant graft: documenting against another tenant's encounter is rejected", async () => {
    const b = await seed(B, "graft");
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          insertObservation(db, {
            id: newId(),
            tenantId: A.tenantId,
            encounterId: b.encounterId, // B's encounter under A
            patientId: fx.patientId,
            code: { system: "loinc", code: "8867-4", display: "Heart rate" },
            valueNumeric: 80,
            unit: "bpm",
            recordedBy: fx.practitionerId,
          }),
        ),
      isForeignKeyViolation,
    );
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          insertCondition(db, {
            id: newId(),
            tenantId: A.tenantId,
            encounterId: b.encounterId,
            patientId: fx.patientId,
            code: { system: "icd-10", code: "R50.9", display: "Fever" },
            category: "diagnosis",
            clinicalStatus: "active",
            recordedBy: fx.practitionerId,
          }),
        ),
      isForeignKeyViolation,
    );
  });
});
