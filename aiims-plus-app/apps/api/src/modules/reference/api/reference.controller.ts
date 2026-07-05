/** Reference code-system endpoints (Stage 1). Read-only, allow-listed filter (APDR-0005). */
import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import {
  listQuerySchema,
  type ListCodeSystemsResponse,
  type ListReferenceCodesResponse,
} from "@aiims/api-contracts";
import { RequirePermission } from "../../../platform/decorators";
import { ReferenceService } from "../application/reference.service";

const codesQuerySchema = listQuerySchema.extend({
  /** Required allow-listed filter — no unbounded cross-system scans (DB §12). */
  system: z.enum(["icd-10", "loinc", "snomed"]),
});

@Controller("v1/reference")
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get("code-systems")
  @RequirePermission("reference:read")
  async listCodeSystems(): Promise<ListCodeSystemsResponse> {
    const rows = await this.reference.listCodeSystems();
    return { data: rows, meta: { nextCursor: null } };
  }

  @Get("codes")
  @RequirePermission("reference:read")
  async listCodes(@Query() rawQuery: unknown): Promise<ListReferenceCodesResponse> {
    const { system, limit, cursor } = codesQuerySchema.parse(rawQuery);
    // Natural-key cursor: the code itself (opaque to clients).
    const rows = await this.reference.listCodes(system, limit, cursor);
    const last = rows[rows.length - 1];
    return {
      data: rows,
      meta: { nextCursor: rows.length === limit && last ? last.code : null },
    };
  }
}
