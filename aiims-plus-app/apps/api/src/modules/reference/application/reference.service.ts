/**
 * Reference reads (DDR-0012). Global tables carry no tenant_id and are
 * read-only to aiims_app (grant-enforced), so no tenant transaction is
 * needed — the one sanctioned raw-pool read path besides the tenant registry.
 */
import { Injectable } from "@nestjs/common";
import {
  listCodeSystems,
  listReferenceCodes,
  type CodeSystemRow,
  type ReferenceCodeRow,
} from "@aiims/db";
import { UnitOfWork } from "../../../platform/db.provider";

@Injectable()
export class ReferenceService {
  constructor(private readonly uow: UnitOfWork) {}

  listCodeSystems(): Promise<CodeSystemRow[]> {
    return listCodeSystems(this.uow.rawPool);
  }

  listCodes(system: string, limit: number, afterCode?: string): Promise<ReferenceCodeRow[]> {
    return listReferenceCodes(this.uow.rawPool, {
      system,
      limit,
      ...(afterCode ? { afterCode } : {}),
    });
  }
}
