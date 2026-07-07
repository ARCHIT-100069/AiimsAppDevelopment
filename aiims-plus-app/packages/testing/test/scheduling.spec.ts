/**
 * Stage 4 integration suite (TDR-0003): OPD scheduling against a real Postgres
 * as `aiims_app`. Proves the Stage 4 guarantees end-to-end:
 *   - DOUBLE-BOOKING is rejected by the DB slot-exclusion constraint, even under
 *     concurrency (the headline requirement) — exactly one of N racing bookings wins;
 *   - check-in opens EXACTLY ONE encounter (idempotent — unique per appointment);
 *   - cross-tenant composite-FK grafts are rejected (DDR-0008);
 *   - optimistic concurrency (stale version updates nothing, DDR-0009);
 *   - queue-token issuance is gap-free and unique under concurrency;
 *   - computed free slots reflect existing bookings.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignRoleIdempotent,
  computeFreeSlots,
  createAppPool,
  findRoleByCode,
  getEncounterByAppointmentId,
  insertAppUser,
  insertAppointment,
  insertAvailability,
  insertDepartment,
  insertEncounter,
  insertFacility,
  insertOrganization,
  insertPatient,
  insertPractitioner,
  isExclusionViolation,
  isForeignKeyViolation,
  isUniqueViolation,
  issueMrn,
  issueQueueToken,
  newId,
  SEED,
  transitionAppointmentVersioned,
  updateAppointmentVersioned,
  withTenantContext,
} from "@aiims/db";
import { setupIsolationEnv, type IsolationEnv } from "../src/index";

let env: IsolationEnv;
let appPool: Pool;

const A = { tenantId: SEED.tenantA, actorId: SEED.tenantA };
const B = { tenantId: SEED.tenantB, actorId: SEED.tenantB };

interface Fixture {
  facilityId: string;
  patientId: string;
  practitionerId: string;
}

/** Build org → facility, a patient, and a practitioner in one tenant. */
async function seed(ctx: typeof A, marker: string): Promise<Fixture> {
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
    await insertDepartment(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      facilityId: fac.id,
      name: `OPD ${marker}`,
      code: "OPD-GEN",
    });
    const patientId = newId();
    await insertPatient(db, {
      id: patientId,
      tenantId: ctx.tenantId,
      mrn: await issueMrn(db, ctx.tenantId),
      nameGiven: "Sched",
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
      registrationNo: `REG-${marker}`,
      specialties: [],
    });
    return { facilityId: fac.id, patientId, practitionerId };
  });
}

let fx: Fixture;

beforeAll(async () => {
  env = await setupIsolationEnv();
  appPool = createAppPool(env.appUrl);
  fx = await seed(A, "tenant-a");
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await env?.stop();
});

/** Run `fn`, expecting it to throw an error matching `predicate`. */
async function expectRejection(
  fn: () => Promise<unknown>,
  predicate: (err: unknown) => boolean,
): Promise<void> {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected the operation to reject").toBeDefined();
  expect(predicate(caught)).toBe(true);
}

const bookInput = (start: string, end: string) => ({
  id: newId(),
  tenantId: A.tenantId,
  patientId: fx.patientId,
  practitionerId: fx.practitionerId,
  facilityId: fx.facilityId,
  startAt: new Date(start),
  endAt: new Date(end),
  appointmentType: "routine" as const,
  specialties: [],
  priority: 0,
});

describe("OPD scheduling (TDR-0003, DDR-0008/0009)", () => {
  it("DOUBLE-BOOKING: N concurrent bookings for the same slot → exactly one wins", async () => {
    const start = "2026-09-01T04:00:00.000Z";
    const end = "2026-09-01T04:15:00.000Z";
    const attempts = Array.from({ length: 6 }, () =>
      withTenantContext(appPool, A, (db) => insertAppointment(db, bookInput(start, end))),
    );
    const results = await Promise.allSettled(attempts);
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    expect(rejected.every((r) => r.status === "rejected" && isExclusionViolation(r.reason))).toBe(
      true,
    );
  });

  it("adjacent (non-overlapping) slots for the same practitioner both succeed", async () => {
    await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, bookInput("2026-09-01T05:00:00.000Z", "2026-09-01T05:15:00.000Z")),
    );
    // Half-open interval [), so 05:15 start does NOT overlap the 05:00–05:15 slot.
    await expect(
      withTenantContext(appPool, A, (db) =>
        insertAppointment(db, bookInput("2026-09-01T05:15:00.000Z", "2026-09-01T05:30:00.000Z")),
      ),
    ).resolves.toBeDefined();
  });

  it("reschedule onto an occupied slot is rejected by the exclusion constraint", async () => {
    const a = await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, bookInput("2026-09-01T06:00:00.000Z", "2026-09-01T06:15:00.000Z")),
    );
    await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, bookInput("2026-09-01T06:30:00.000Z", "2026-09-01T06:45:00.000Z")),
    );
    // Move `a` on top of the 06:30 booking → overlap → 23P01.
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          updateAppointmentVersioned(db, a.id, 0, {
            startAt: new Date("2026-09-01T06:30:00.000Z"),
            endAt: new Date("2026-09-01T06:45:00.000Z"),
          }),
        ),
      isExclusionViolation,
    );
  });

  it("check-in opens EXACTLY ONE encounter (idempotent per appointment)", async () => {
    const a = await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, bookInput("2026-09-01T07:00:00.000Z", "2026-09-01T07:15:00.000Z")),
    );
    const encounterId = newId();
    await withTenantContext(appPool, A, async (db) => {
      const token = await issueQueueToken(db, {
        tenantId: A.tenantId,
        facilityId: fx.facilityId,
        departmentId: null,
        serviceDate: "2026-09-01",
      });
      expect(token).toBeGreaterThan(0);
      const moved = await transitionAppointmentVersioned(db, a.id, 0, "booked", {
        status: "checked_in",
        queueToken: token,
        checkedIn: true,
      });
      expect(moved?.status).toBe("checked_in");
      await insertEncounter(db, {
        id: encounterId,
        tenantId: A.tenantId,
        appointmentId: a.id,
        patientId: fx.patientId,
        practitionerId: fx.practitionerId,
        facilityId: fx.facilityId,
      });
    });
    // A second encounter for the same appointment must be rejected (unique).
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          insertEncounter(db, {
            id: newId(),
            tenantId: A.tenantId,
            appointmentId: a.id,
            patientId: fx.patientId,
            practitionerId: fx.practitionerId,
            facilityId: fx.facilityId,
          }),
        ),
      isUniqueViolation,
    );
    const found = await withTenantContext(appPool, A, (db) =>
      getEncounterByAppointmentId(db, a.id),
    );
    expect(found?.id).toBe(encounterId);
  });

  it("optimistic concurrency: a stale version updates nothing (DDR-0009)", async () => {
    const a = await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, bookInput("2026-09-01T08:00:00.000Z", "2026-09-01T08:15:00.000Z")),
    );
    await withTenantContext(appPool, A, async (db) => {
      const bumped = await updateAppointmentVersioned(db, a.id, 0, { priority: 5 });
      expect(bumped?.version).toBe(1);
      const stale = await updateAppointmentVersioned(db, a.id, 0, { priority: 9 });
      expect(stale).toBeUndefined();
    });
  });

  it("composite FK (DDR-0008): cannot book with another tenant's practitioner", async () => {
    const other = await seed(B, "tenant-b");
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          insertAppointment(db, {
            ...bookInput("2026-09-02T04:00:00.000Z", "2026-09-02T04:15:00.000Z"),
            practitionerId: other.practitionerId, // B's practitioner under A
          }),
        ),
      isForeignKeyViolation,
    );
  });

  it("queue tokens are gap-free and unique under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        withTenantContext(appPool, A, (db) =>
          issueQueueToken(db, {
            tenantId: A.tenantId,
            facilityId: fx.facilityId,
            departmentId: null,
            serviceDate: "2026-12-25",
          }),
        ),
      ),
    );
    expect(new Set(results).size).toBe(15);
    expect(Math.max(...results)).toBe(15);
  });

  it("computed free slots reflect existing bookings (D-4.2)", async () => {
    const date = "2026-09-07"; // a Monday
    await withTenantContext(appPool, A, (db) =>
      insertAvailability(db, {
        id: newId(),
        tenantId: A.tenantId,
        practitionerId: fx.practitionerId,
        facilityId: fx.facilityId,
        dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
        startTime: "09:00",
        endTime: "10:00",
        slotMinutes: 15,
      }),
    );
    const before = await withTenantContext(appPool, A, (db) =>
      computeFreeSlots(db, fx.practitionerId, date),
    );
    expect(before.length).toBe(4); // 09:00–10:00 IST / 15m
    // Book the first free slot; it should disappear from the recomputed list.
    const first = before[0]!;
    await withTenantContext(appPool, A, (db) =>
      insertAppointment(db, {
        ...bookInput(first.startAt.toISOString(), first.endAt.toISOString()),
      }),
    );
    const after = await withTenantContext(appPool, A, (db) =>
      computeFreeSlots(db, fx.practitionerId, date),
    );
    expect(after.length).toBe(3);
    expect(after.some((s) => s.startAt.getTime() === first.startAt.getTime())).toBe(false);
  });
});
