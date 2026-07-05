/**
 * Audit append (ADR-0005, DDR-0007, BDR-0004): called by application services
 * INSIDE the business transaction, so business write + outbox event + audit
 * row commit atomically ("one transaction = one tenant + write + outbox +
 * audit", Master Plan §3.4). The audit row id equals the outbox event id —
 * a 1:1, idempotent correspondence. Context carries request metadata and
 * references only, never PHI (SDR-0010).
 */
import { Injectable } from "@nestjs/common";
import { appendAuditRow, type TenantDb } from "@aiims/db";
import { currentContext } from "./request-context";

export interface AuditEntry {
  /** The outbox event id emitted in the same transaction. */
  eventId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: Date;
  consentRef?: string;
}

export interface AuditActor {
  /** Tenant whose chain the row joins (= the RLS context of the transaction). */
  tenantId: string;
  /** app_user.id for tenant actors; Keycloak sub for platform operators. */
  actorId: string;
}

@Injectable()
export class AuditService {
  async append(db: TenantDb, actor: AuditActor, entry: AuditEntry): Promise<void> {
    await appendAuditRow(db, {
      id: entry.eventId,
      tenantId: actor.tenantId,
      actorId: actor.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      occurredAt: entry.occurredAt,
      consentRef: entry.consentRef,
      context: { correlationId: currentContext().correlationId, source: "api" },
    });
  }
}
