import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { uuidv7 } from "uuidv7";
import type { Sql } from "postgres";

@Injectable()
export class AuditService {
  /** Append a hash-chained audit row (no PHI) within the SAME tx as the business write. */
  async record(tx: Sql, e: { tenantId: string; actorId?: string; action: string; resourceType: string; resourceId?: string; context?: unknown }) {
    const prev = await tx`select row_hash from audit.audit_log where tenant_id = ${e.tenantId} order by occurred_at desc limit 1`;
    const prevHash: Buffer | null = prev.length ? (prev[0] as any).row_hash : null;
    const canonical = JSON.stringify({ t: e.tenantId, a: e.actorId, ac: e.action, rt: e.resourceType, ri: e.resourceId, c: e.context ?? {} });
    const rowHash = createHash("sha256").update(prevHash ?? Buffer.alloc(0)).update(canonical).digest();
    await tx`insert into audit.audit_log (id, tenant_id, actor_id, action, resource_type, resource_id, context, prev_hash, row_hash)
             values (${uuidv7()}, ${e.tenantId}, ${e.actorId ?? null}, ${e.action}, ${e.resourceType}, ${e.resourceId ?? null},
                     ${tx.json(e.context ?? {})}, ${prevHash}, ${rowHash})`;
  }
}
