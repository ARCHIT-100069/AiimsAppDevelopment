import { Injectable } from "@nestjs/common";
import { uuidv7 } from "uuidv7";
import type { Sql } from "postgres";

@Injectable()
export class OutboxService {
  /** Write a domain event in the SAME tx as the business change (transactional outbox; DDR 0007). */
  async emit(tx: Sql, e: { tenantId: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown }) {
    await tx`insert into platform.outbox (id, tenant_id, aggregate_type, aggregate_id, event_type, payload)
             values (${uuidv7()}, ${e.tenantId}, ${e.aggregateType}, ${e.aggregateId}, ${e.eventType}, ${tx.json(e.payload as any)})`;
  }
}
