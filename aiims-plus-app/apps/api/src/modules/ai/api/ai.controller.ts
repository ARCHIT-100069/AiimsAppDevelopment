/**
 * AI endpoints (Stage 7). Operational-only, HITL. The capability is dark by
 * default (feature flag) and returns a labelled, advisory suggestion that is
 * never auto-applied. RBAC: clinicians (`ai:use`).
 */
import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { codingSuggestRequestSchema, type CodingSuggestResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { AiService } from "../application/ai.service";

@Controller("v1/ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("coding-suggestion")
  @HttpCode(200)
  @RequirePermission("ai:use")
  async codingSuggestion(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<CodingSuggestResponse> {
    const { text } = codingSuggestRequestSchema.parse(rawBody);
    return this.ai.codingAssist(principal, text);
  }
}
