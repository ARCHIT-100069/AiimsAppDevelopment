/**
 * Feedback endpoints (staff/quality read). Patient-satisfaction data is read by
 * admin/quality (feedback:read). Patients submit via /v1/me/feedback. Tenant
 * -scoped by the service under RLS.
 */
import { Controller, Get } from "@nestjs/common";
import type { FeedbackResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { FeedbackService } from "../application/feedback.service";

@Controller("v1")
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get("feedback")
  @RequirePermission("feedback:read")
  async list(@CurrentPrincipal() principal: Principal): Promise<{ data: FeedbackResponse[] }> {
    return { data: await this.feedback.list(principal) };
  }
}
