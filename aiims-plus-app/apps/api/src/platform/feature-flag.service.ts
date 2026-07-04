/**
 * Feature flags (ADR-0010, BDR-0011): DB-backed (platform.feature_flag),
 * per-tenant override over global default. Gates mock↔real adapters and
 * dark-launches Production features.
 */
import { Injectable } from "@nestjs/common";
import type { FeatureFlagReader } from "@aiims/config";
import { isFlagEnabled } from "@aiims/db";
import { UnitOfWork } from "./db.provider";

const SYSTEM_ACTOR = "00000000-0000-7000-8000-000000000000";

@Injectable()
export class FeatureFlagService implements FeatureFlagReader {
  constructor(private readonly uow: UnitOfWork) {}

  async isEnabled(key: string, tenantId?: string): Promise<boolean> {
    if (!tenantId) return false; // flags are tenant-resolved; no ambient default
    return this.uow.withTenant({ tenantId, actorId: SYSTEM_ACTOR }, (db) =>
      isFlagEnabled(db, key, tenantId),
    );
  }
}
