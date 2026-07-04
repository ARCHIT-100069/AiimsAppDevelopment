import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@aiims/api-contracts";
import { Public } from "./decorators";

/** The ONLY public endpoint in Stage 0 (APDR-0011): liveness/readiness. */
@Controller()
export class HealthController {
  @Public()
  @Get("healthz")
  health(): HealthResponse {
    return { status: "ok", service: "aiims-api", version: "0.0.0" };
  }
}
