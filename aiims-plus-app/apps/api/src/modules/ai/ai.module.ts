import { Module } from "@nestjs/common";
import { AiController } from "./api/ai.controller";
import { AiService } from "./application/ai.service";

/**
 * AI module (Stage 7, AIDR-0002) — the operational-only AI surface. Reaches the
 * isolated plane ONLY through the AiGateway seam (mock by default). Every call
 * is flag-gated, safety-screened, PHI-redacted, audited, and returns an
 * advisory, human-verified suggestion. There is NO write path to clinical data.
 */
@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
