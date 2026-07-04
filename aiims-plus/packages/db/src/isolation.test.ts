/**
 * TDR-0006 — Cross-tenant isolation gate (CANONICAL). Runs against a REAL PostgreSQL as role
 * `aiims_app` (NOT owner, NO BYPASSRLS) so FORCE RLS is exercised exactly as in production.
 * This is the single most important test in the repo (DDR 0002 / DB §17).
 *
 * Requires: DATABASE_URL_APP pointing at the DB connected as aiims_app, migrations applied.
 * Run:  node --test  (after build)  — or via CI service Postgres.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { withTenant } from "./tenant-context.js";

const A = "018f0000-0000-7000-8000-00000000000a";
const B = "018f0000-0000-7000-8000-00000000000b";
const sql = postgres(process.env.DATABASE_URL_APP!, { max: 4 });

test("seed two tenants + a note each (as their own tenant context)", async () => {
  for (const id of [A, B]) {
    // tenant table is not RLS'd; upsert directly
    await sql`insert into platform.tenant (id, slug, name) values (${id}, ${"t-"+id.slice(-1)}, ${"Tenant "+id.slice(-1)})
              on conflict (id) do nothing`;
    await withTenant(sql, { tenantId: id }, async (tx) => {
      await tx`insert into platform.note (id, tenant_id, body) values (gen_random_uuid(), ${id}, ${"note for "+id})`;
    });
  }
});

test("A cannot SELECT B's rows (fail-closed RLS)", async () => {
  const rows = await withTenant(sql, { tenantId: A }, (tx) =>
    tx`select id from platform.note where tenant_id = ${B}`);
  assert.equal(rows.length, 0, "cross-tenant SELECT must return zero rows");
});

test("A cannot UPDATE/DELETE B's rows", async () => {
  const upd = await withTenant(sql, { tenantId: A }, (tx) =>
    tx`update platform.note set body = 'hacked' where tenant_id = ${B} returning id`);
  assert.equal(upd.length, 0, "cross-tenant UPDATE must affect zero rows");
  const del = await withTenant(sql, { tenantId: A }, (tx) =>
    tx`delete from platform.note where tenant_id = ${B} returning id`);
  assert.equal(del.length, 0, "cross-tenant DELETE must affect zero rows");
});

test("WITH CHECK rejects writing another tenant's tenant_id", async () => {
  await assert.rejects(
    withTenant(sql, { tenantId: A }, (tx) =>
      tx`insert into platform.note (id, tenant_id, body) values (gen_random_uuid(), ${B}, 'smuggled')`),
    "inserting B's tenant_id under A's context must be rejected by WITH CHECK");
});

test("unset tenant context => fail-closed (zero rows)", async () => {
  const rows = await sql`select id from platform.note`; // no SET LOCAL app.tenant_id
  assert.equal(rows.length, 0, "with no tenant context, RLS must expose zero rows");
});

test.after(async () => { await sql.end(); });
