import { Injectable } from "@nestjs/common";
import { tx } from "./tenant-context.js";
@Injectable()
export class FeatureFlagService {
  async enabled(key: string): Promise<boolean> {
    const rows = await tx()`select enabled from platform.feature_flag where key = ${key}
                            order by tenant_id nulls last limit 1`;
    return rows.length ? Boolean((rows[0] as any).enabled) : false;
  }
}
