/**
 * OFFLINE SEMANTIC MODEL of the RLS predicate (Node built-ins only; no Postgres).
 * NOT a substitute for isolation.test.ts against real Postgres — it exists only to demonstrate,
 * in an environment without a database, that the fail-closed / WITH CHECK / policy-removal
 * semantics behave as designed. The CANONICAL gate (TDR-0006) is isolation.test.ts in CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of migration 0000: USING/WITH CHECK = (tenant_id = current_setting('app.tenant_id')).
// current_setting(..., true) returns null when unset -> predicate false -> fail-closed.
function makeTable({ forceRls = true } = {}) {
  const rows = [];
  const predicate = (row, ctxTenant) =>
    !forceRls ? true : (ctxTenant != null && row.tenant_id === ctxTenant); // null ctx => false
  return {
    insert(row, ctxTenant) {                      // WITH CHECK
      if (forceRls && row.tenant_id !== ctxTenant)
        throw new Error("new row violates row-level security policy (WITH CHECK)");
      rows.push(row);
    },
    select(ctxTenant) { return rows.filter((r) => predicate(r, ctxTenant)); }, // USING
    update(ctxTenant, patch, whereTenant) {
      const hit = rows.filter((r) => predicate(r, ctxTenant) && r.tenant_id === whereTenant);
      hit.forEach((r) => Object.assign(r, patch));
      return hit.length;
    },
  };
}

const A = "tenantA", B = "tenantB";

test("A cannot SELECT B's rows (fail-closed)", () => {
  const t = makeTable();
  t.insert({ id: 1, tenant_id: A, body: "a" }, A);
  t.insert({ id: 2, tenant_id: B, body: "b" }, B);
  assert.equal(t.select(A).filter((r) => r.tenant_id === B).length, 0);
});

test("WITH CHECK rejects smuggling B's tenant_id under A", () => {
  const t = makeTable();
  assert.throws(() => t.insert({ id: 3, tenant_id: B, body: "x" }, A));
});

test("unset context => zero rows (fail-closed)", () => {
  const t = makeTable();
  t.insert({ id: 1, tenant_id: A }, A);
  assert.equal(t.select(null).length, 0);
});

test("A cannot UPDATE B's rows", () => {
  const t = makeTable();
  t.insert({ id: 2, tenant_id: B, body: "b" }, B);
  assert.equal(t.update(A, { body: "hacked" }, B), 0);
});

test("GUARDRAIL: removing the policy (forceRls=false) LEAKS -> gate fails", () => {
  const leaky = makeTable({ forceRls: false });
  leaky.insert({ id: 2, tenant_id: B, body: "b" }, A);
  // With no policy, A sees B's row => this assertion FAILS, which is the point:
  // deleting an RLS policy must make the isolation suite red (DDR 0011 guardrail).
  assert.throws(() => assert.equal(leaky.select(A).filter((r) => r.tenant_id === B).length, 0),
    "policy removal must break isolation (proves the guardrail catches it)");
});
