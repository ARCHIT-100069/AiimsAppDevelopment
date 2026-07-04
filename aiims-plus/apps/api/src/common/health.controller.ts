import { Controller, Get } from "@nestjs/common";
import { sql } from "../platform/db.provider.js";
@Controller("health")
export class HealthController {
  @Get()
  async health() { try { await sql`select 1`; return { status: "ok" }; } catch { return { status: "degraded" }; } }
}
