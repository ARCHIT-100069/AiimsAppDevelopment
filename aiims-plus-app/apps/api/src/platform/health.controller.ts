import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import type { HealthResponse } from "@aiims/api-contracts";
import { Public } from "./decorators";
import { UnitOfWork } from "./db.provider";

/** The ONLY public endpoints (APDR-0011): liveness + readiness probes. */
@Controller()
export class HealthController {
  constructor(private readonly uow: UnitOfWork) {}

  @Public()
  @Get("healthz")
  health(): HealthResponse {
    return { status: "ok", service: "aiims-api", version: "0.0.0" };
  }

  /** Readiness (IDR-0013): the service is ready only if the database answers. */
  @Public()
  @Get("readyz")
  async ready(): Promise<HealthResponse> {
    try {
      await this.uow.rawPool.query("SELECT 1");
    } catch {
      throw new ServiceUnavailableException("database unreachable");
    }
    return { status: "ok", service: "aiims-api", version: "0.0.0" };
  }
}
