/**
 * Audit-integrity verifier (ODR-0011 / DDR-0007 — WORM tamper-evidence).
 *
 * Re-walks the per-tenant hash chain and proves it is intact:
 *   1. the first row's prev_hash is genesis (all-zero);
 *   2. every row's prev_hash equals the previous row's row_hash (LINKAGE —
 *      catches insertion, deletion, reordering, truncation);
 *   3. every row's row_hash equals sha256(prev || canonical(fields)) (catches
 *      any field-level tampering).
 * Returns a list of human-readable problems ([] = intact). Runs as a CLI
 * (`pnpm --filter @aiims/db verify:audit`) and can gate CI.
 */
import { Client } from "pg";
import { canonicalAudit, GENESIS_HASH, type AuditHashFields, type HashBytes } from "./audit-hash";
import { createHash } from "node:crypto";

export interface AuditChainRow extends AuditHashFields {
  prevHash: HashBytes;
  rowHash: HashBytes;
}

/** Pure verifier over rows already ordered by (occurredAt, id) per tenant. */
export function verifyAuditChain(rowsByTenant: Map<string, AuditChainRow[]>): string[] {
  const problems: string[] = [];
  for (const [tenantId, rows] of rowsByTenant) {
    let expectedPrev = GENESIS_HASH;
    rows.forEach((row, i) => {
      if (!row.prevHash.equals(expectedPrev)) {
        problems.push(`tenant ${tenantId} row ${i} (${row.id}): prev_hash breaks the chain`);
      }
      const recomputed = createHash("sha256")
        .update(row.prevHash)
        .update(canonicalAudit(row))
        .digest();
      if (!recomputed.equals(row.rowHash)) {
        problems.push(
          `tenant ${tenantId} row ${i} (${row.id}): row_hash does not match its data (tampered)`,
        );
      }
      expectedPrev = row.rowHash;
    });
  }
  return problems;
}

/** Read every audit row and verify the chain. Reads as owner/migrator (all tenants). */
export async function verifyAuditIntegrity(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      tenant_id: string;
      actor_id: string;
      action: string;
      resource_type: string;
      resource_id: string;
      occurred_at: Date;
      consent_ref: string | null;
      context: Record<string, unknown>;
      prev_hash: Buffer;
      row_hash: Buffer;
    }>(
      `SELECT id, tenant_id, actor_id, action, resource_type, resource_id,
              occurred_at, consent_ref, context, prev_hash, row_hash
         FROM audit.audit_log
        ORDER BY tenant_id, occurred_at, id`,
    );
    const byTenant = new Map<string, AuditChainRow[]>();
    for (const r of rows) {
      const list = byTenant.get(r.tenant_id) ?? [];
      list.push({
        id: r.id,
        tenantId: r.tenant_id,
        actorId: r.actor_id,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        occurredAt: r.occurred_at.toISOString(),
        consentRef: r.consent_ref,
        context: r.context ?? {},
        prevHash: r.prev_hash,
        rowHash: r.row_hash,
      });
      byTenant.set(r.tenant_id, list);
    }
    return verifyAuditChain(byTenant);
  } finally {
    await client.end();
  }
}

/* CLI: exit 1 on any integrity problem (ODR-0011 gate). */
if (require.main === module) {
  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.ISOLATION_DATABASE_URL;
  if (!url) {
    process.stderr.write("verify-audit: DATABASE_URL_MIGRATOR is required\n");
    process.exit(2);
  }
  verifyAuditIntegrity(url)
    .then((problems) => {
      if (problems.length === 0) {
        process.stdout.write("audit integrity gate: hash chain intact across all tenants\n");
        process.exit(0);
      }
      process.stderr.write(
        `audit integrity FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`,
      );
      process.exit(1);
    })
    .catch((err: unknown) => {
      process.stderr.write(`verify-audit error: ${(err as Error).message}\n`);
      process.exit(2);
    });
}
