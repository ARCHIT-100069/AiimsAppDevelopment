/**
 * AI application service (Stage 7) — the ONE place the core talks to AI, via the
 * AiGateway seam. Constitution gates, in order: feature-flag (dark by default) →
 * operational-only safety → PHI redaction → gateway (mock/plane) → AI audit +
 * outbox. The result is ADVISORY and labelled; NOTHING is written to clinical
 * records here (HITL, no write path). AI failure never blocks care (AIDR-0014).
 */
import { Inject, Injectable } from "@nestjs/common";
import type { CodingSuggestResponse } from "@aiims/api-contracts";
import { AI_LABEL } from "@aiims/api-contracts";
import { insertOutboxEvent, newId } from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { AI_SUGGESTION_GENERATED_V1 } from "@aiims/event-schemas";
import { AI_GATEWAY, type AiGateway } from "../../../adapters/ports";
import { DomainError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { FeatureFlagService } from "../../../platform/feature-flag.service";
import { UnitOfWork } from "../../../platform/db.provider";
import { AiSafetyError, assertOperationallySafe, redactPhi } from "../domain/ai-guards";

const DISCLAIMER =
  "Operational assistance only. Suggestions are advisory, must be verified by a clinician, " +
  "and are never applied automatically (AI Constitution).";

@Injectable()
export class AiService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    private readonly flags: FeatureFlagService,
    @Inject(AI_GATEWAY) private readonly ai: AiGateway,
  ) {}

  async codingAssist(principal: Principal, text: string): Promise<CodingSuggestResponse> {
    // 1. Dark by default: the capability is 404 unless the tenant flag is on.
    if (!(await this.flags.isEnabled("ai.coding_assist", principal.tenantId))) {
      throw new NotFoundError("Not found");
    }
    // 2. Operational-only safety (injection / clinical-decision) → 422.
    try {
      assertOperationallySafe(text);
    } catch (err) {
      if (err instanceof AiSafetyError) throw new DomainError(err.message);
      throw err;
    }
    // 3. Redact PHI before it leaves the core (AIDR-0008).
    const { text: redacted, applied } = redactPhi(text);

    // 4. The single AI egress (mock or the isolated plane).
    const result = await this.ai.codingAssist({ text: redacted, tenantRef: principal.tenantId });

    // 5. AI audit (AIDR-0011): references + provider only — never prompt/PHI.
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    const requestId = newId();
    await this.uow.withTenant(actor, async (db) => {
      await insertOutboxEvent(db, {
        id: requestId,
        tenantId: principal.tenantId,
        aggregateType: "ai",
        aggregateId: requestId,
        eventType: AI_SUGGESTION_GENERATED_V1,
        payload: { requestId, capability: "coding_assist", provider: result.provider },
      });
      await this.audit.append(db, actor, {
        eventId: requestId,
        action: "ai.coding_assist",
        resourceType: "ai",
        resourceId: requestId,
        occurredAt: new Date(),
      });
    });

    return {
      capability: "coding_assist",
      label: AI_LABEL,
      suggestions: result.suggestions,
      redactionApplied: applied || result.redactionApplied,
      provider: result.provider,
      disclaimer: DISCLAIMER,
    };
  }
}
