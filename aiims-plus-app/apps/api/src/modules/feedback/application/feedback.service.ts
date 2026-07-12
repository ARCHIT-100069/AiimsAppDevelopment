/**
 * Feedback / quality application service. Staff (admin/quality) read of
 * patient-satisfaction data (NABH). Reads run inside the tenant RLS context via
 * the global UnitOfWork. Patients SUBMIT feedback through the /v1/me surface
 * (MeService) — this module is the read side for the hospital.
 */
import { Injectable } from "@nestjs/common";
import { listFeedback } from "@aiims/db";
import type { FeedbackResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { UnitOfWork } from "../../../platform/db.provider";

@Injectable()
export class FeedbackService {
  constructor(private readonly uow: UnitOfWork) {}

  async list(principal: Principal): Promise<FeedbackResponse[]> {
    const rows = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => listFeedback(db),
    );
    return rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      category: r.category,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
