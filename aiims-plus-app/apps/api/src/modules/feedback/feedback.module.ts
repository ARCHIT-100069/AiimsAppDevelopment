import { Module } from "@nestjs/common";
import { FeedbackController } from "./api/feedback.controller";
import { FeedbackService } from "./application/feedback.service";

/**
 * Feedback / quality module — staff read of patient-satisfaction data (NABH).
 * Patients submit via the /v1/me surface; this is the read side. Uses the
 * global UnitOfWork; adds no adapters.
 */
@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
