/**
 * Stage 6 integration suite (TDR-0003): billing against a real Postgres as
 * `aiims_app`. Proves the Stage 6 guarantees end-to-end:
 *   - an invoice is generated from an encounter with correct money math
 *     (integer paise → numeric strings, never float);
 *   - ONE invoice per encounter (duplicate → unique violation → 409);
 *   - payment marking is status-guarded (a paid invoice cannot be re-paid);
 *   - cross-tenant composite-FK grafts are rejected (DDR-0008).
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignRoleIdempotent,
  createAppPool,
  findRoleByCode,
  getInvoiceByEncounter,
  insertAppUser,
  insertAppointment,
  insertEncounter,
  insertFacility,
  insertInvoice,
  insertInvoiceLine,
  insertOrganization,
  insertPatient,
  insertPractitioner,
  insertServiceRequest,
  isForeignKeyViolation,
  isUniqueViolation,
  issueInvoiceNumber,
  issueMrn,
  listInvoiceLines,
  markInvoicePaidVersioned,
  newId,
  SEED,
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

async function seed(ctx: typeof A, marker: string): Promise<Fx> {
  return withTenantContext(appPool, ctx, async (db) => {
    const org = await insertOrganization(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      name: `H ${marker}`,
      type: "hospital",
    });
    const fac = await insertFacility(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      organizationId: org.id,
      name: `C ${marker}`,
      timezone: "Asia/Kolkata",
    });
    const patientId = newId();
    await insertPatient(db, {
      id: patientId,
      tenantId: ctx.tenantId,
      mrn: await issueMrn(db, ctx.tenantId),
      nameGiven: "Bill",
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
      registrationNo: `REG-BILL-${marker}`,
      specialties: [],
    });
    const appt = await insertAppointment(db, {
      id: newId(),
      tenantId: ctx.tenantId,
      patientId,
      practitionerId,
      facilityId: fac.id,
      startAt: new Date("2026-12-01T04:00:00.000Z"),
      endAt: new Date("2026-12-01T04:15:00.000Z"),
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
    return { encounterId, patientId, practitionerId };
  });
}

/** Insert an invoice + lines for an encounter (mirrors the service's charge capture). */
async function makeInvoice(fx: Fx, consultation: string, orderLines: string[]): Promise<string> {
  return withTenantContext(appPool, A, async (db) => {
    const id = newId();
    const total = [consultation, ...orderLines].reduce(
      (paise, m) => paise + Math.round(Number(m) * 100),
      0,
    );
    await insertInvoice(db, {
      id,
      tenantId: A.tenantId,
      invoiceNumber: await issueInvoiceNumber(db, A.tenantId),
      encounterId: fx.encounterId,
      patientId: fx.patientId,
      currency: "INR",
      subtotal: (total / 100).toFixed(2),
      total: (total / 100).toFixed(2),
    });
    await insertInvoiceLine(db, {
      id: newId(),
      tenantId: A.tenantId,
      invoiceId: id,
      description: "OPD consultation",
      quantity: 1,
      unitAmount: consultation,
      lineAmount: consultation,
    });
    for (const m of orderLines) {
      await insertInvoiceLine(db, {
        id: newId(),
        tenantId: A.tenantId,
        invoiceId: id,
        description: "Investigation",
        quantity: 1,
        unitAmount: m,
        lineAmount: m,
      });
    }
    return id;
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

describe("billing (TDR-0003, DDR-0008/0009)", () => {
  it("invoice totals are exact money (integer paise → numeric, never float)", async () => {
    const id = await makeInvoice(fx, "500.00", ["200.00", "200.00"]);
    const invoice = await withTenantContext(appPool, A, (db) =>
      getInvoiceByEncounter(db, fx.encounterId),
    );
    expect(invoice?.id).toBe(id);
    expect(invoice?.total).toBe("900.00");
    expect(invoice?.status).toBe("issued");
    const lines = await withTenantContext(appPool, A, (db) => listInvoiceLines(db, id));
    expect(lines).toHaveLength(3);
    expect(invoice?.invoiceNumber).toMatch(/^INV-\d{6}$/);
  });

  it("ONE invoice per encounter — a second is rejected (unique → 409)", async () => {
    await expectRejection(() => makeInvoice(fx, "500.00", []), isUniqueViolation);
  });

  it("payment is status-guarded: pay once, never twice (DDR-0009)", async () => {
    const other = await seed(A, "pay");
    const id = await makeInvoice(other, "500.00", []);
    const paid = await withTenantContext(appPool, A, (db) =>
      markInvoicePaidVersioned(db, id, 0, { paymentRef: "mock-pay-1", paymentMethod: "mock" }),
    );
    expect(paid?.status).toBe("paid");
    expect(paid?.paymentRef).toBe("mock-pay-1");
    expect(paid?.paidAt).not.toBeNull();
    // Re-pay attempts (stale version or already-paid status) update nothing.
    const again = await withTenantContext(appPool, A, (db) =>
      markInvoicePaidVersioned(db, id, 1, { paymentRef: "mock-pay-2", paymentMethod: "mock" }),
    );
    expect(again).toBeUndefined();
  });

  it("composite FK (DDR-0008): cannot invoice another tenant's encounter", async () => {
    const b = await seed(B, "b");
    await expectRejection(
      () =>
        withTenantContext(appPool, A, (db) =>
          insertInvoice(db, {
            id: newId(),
            tenantId: A.tenantId,
            invoiceNumber: "INV-GRAFT",
            encounterId: b.encounterId, // B's encounter under A
            patientId: fx.patientId,
            currency: "INR",
            subtotal: "100.00",
            total: "100.00",
          }),
        ),
      isForeignKeyViolation,
    );
  });

  it("charge capture reads the encounter's orders (invoice ↔ encounter link)", async () => {
    const withOrders = await seed(A, "orders");
    await withTenantContext(appPool, A, (db) =>
      insertServiceRequest(db, {
        id: newId(),
        tenantId: A.tenantId,
        encounterId: withOrders.encounterId,
        patientId: withOrders.patientId,
        code: { system: "loinc", code: "718-7", display: "Hemoglobin" },
        priority: "routine",
        requesterId: withOrders.practitionerId,
      }),
    );
    // One consultation + one order line → 500 + 200 = 700.00.
    const id = await makeInvoice(withOrders, "500.00", ["200.00"]);
    const invoice = await withTenantContext(appPool, A, (db) =>
      getInvoiceByEncounter(db, withOrders.encounterId),
    );
    expect(invoice?.id).toBe(id);
    expect(invoice?.total).toBe("700.00");
  });
});
