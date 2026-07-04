import { Injectable } from "@nestjs/common";
import { uuidv7 } from "uuidv7";
import { tx } from "../../platform/tenant-context.js";
import { AuditService } from "../../platform/audit.service.js";
import { OutboxService } from "../../platform/outbox.service.js";

@Injectable()
export class NoteService {
  constructor(private audit: AuditService, private outbox: OutboxService) {}

  /** Business write + outbox event + audit — all in the ONE request tx (BDR-0004). */
  async create(tenantId: string, actorId: string, body: string) {
    const t = tx();
    const id = uuidv7();
    const [row] = await t`insert into platform.note (id, tenant_id, body, created_by)
                          values (${id}, ${tenantId}, ${body}, ${actorId})
                          returning id, body, version`;
    await this.outbox.emit(t, { tenantId, aggregateType: "note", aggregateId: id, eventType: "note.created.v1",
                                payload: { type: "note.created.v1", tenantId, noteId: id, occurredAt: new Date().toISOString() } });
    await this.audit.record(t, { tenantId, actorId, action: "note.create", resourceType: "note", resourceId: id });
    return row as { id: string; body: string; version: number };
  }

  async list(tenantId: string) {
    return tx()`select id, body, version from platform.note where tenant_id = ${tenantId} and deleted_at is null`;
  }
}
