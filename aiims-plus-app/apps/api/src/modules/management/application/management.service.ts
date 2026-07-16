/**
 * Management/analytics application service. Read-only aggregate rollups for the
 * leadership dashboard, computed inside the tenant RLS context. Returns no PHI —
 * only counts and totals.
 */
import { Injectable } from "@nestjs/common";
import { getManagementOverview } from "@aiims/db";
import type { ManagementOverview } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { UnitOfWork } from "../../../platform/db.provider";

@Injectable()
export class ManagementService {
  constructor(private readonly uow: UnitOfWork) {}

  async overview(principal: Principal): Promise<ManagementOverview> {
    // "Today" in IST — the OPD day the leadership cares about.
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs);
    const dayKey = istNow.toISOString().slice(0, 10);
    const dayStart = new Date(`${dayKey}T00:00:00.000+05:30`);
    const dayEnd = new Date(`${dayKey}T23:59:59.999+05:30`);

    return this.uow.withTenant({ tenantId: principal.tenantId, actorId: principal.actorId }, (db) =>
      getManagementOverview(db, dayStart, dayEnd),
    );
  }
}
