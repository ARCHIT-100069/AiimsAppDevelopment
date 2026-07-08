import { describe, expect, it } from "vitest";
import { computeRowHash, GENESIS_HASH, type AuditHashFields } from "./audit-hash";
import { verifyAuditChain, type AuditChainRow } from "./verify-audit";

const T = "0197a000-0000-7000-8000-00000000000a";

function row(i: number, prevHash: Buffer, over: Partial<AuditHashFields> = {}): AuditChainRow {
  const fields: AuditHashFields = {
    id: `0197a000-0000-7000-8000-00000000000${i}`,
    tenantId: T,
    actorId: "actor-1",
    action: `action.${i}`,
    resourceType: "patient",
    resourceId: "res-1",
    occurredAt: `2026-08-0${i}T09:00:00.000Z`,
    consentRef: null,
    context: { correlationId: `c-${i}`, source: "api" },
    ...over,
  };
  return { ...fields, prevHash, rowHash: computeRowHash(prevHash, fields) };
}

function chain(n: number): AuditChainRow[] {
  const rows: AuditChainRow[] = [];
  let prev = GENESIS_HASH;
  for (let i = 1; i <= n; i++) {
    const r = row(i, prev);
    rows.push(r);
    prev = r.rowHash;
  }
  return rows;
}

describe("audit-integrity verifier (ODR-0011 / WORM)", () => {
  it("an intact chain has no problems (key order in context is irrelevant)", () => {
    expect(verifyAuditChain(new Map([[T, chain(5)]]))).toEqual([]);
  });

  it("empty chain is trivially intact", () => {
    expect(verifyAuditChain(new Map([[T, []]]))).toEqual([]);
  });

  it("FIELD tampering (row_hash no longer matches the data) is detected", () => {
    const rows = chain(4);
    // Attacker edits the action but leaves row_hash intact.
    rows[2] = { ...rows[2]!, action: "action.HIJACKED" };
    const problems = verifyAuditChain(new Map([[T, rows]]));
    expect(problems.some((p) => p.includes("tampered"))).toBe(true);
  });

  it("DELETION / reordering breaks the prev_hash linkage", () => {
    const rows = chain(5);
    rows.splice(2, 1); // remove the middle row
    const problems = verifyAuditChain(new Map([[T, rows]]));
    expect(problems.some((p) => p.includes("breaks the chain"))).toBe(true);
  });

  it("a forged genesis (non-zero first prev_hash) is detected", () => {
    const rows = chain(3);
    rows[0] = { ...rows[0]!, prevHash: Buffer.alloc(32, 1) };
    const problems = verifyAuditChain(new Map([[T, rows]]));
    expect(problems.length).toBeGreaterThan(0);
  });
});
