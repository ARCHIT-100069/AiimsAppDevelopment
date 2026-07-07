/**
 * OPD waiting-queue endpoint (Stage 4). The queue is a live query over active
 * appointments for a facility/day, ordered by priority then token (D-4.3).
 */
import { Controller, Get, Query } from "@nestjs/common";
import { queueQuerySchema, type QueueResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { SchedulingService } from "../application/scheduling.service";

@Controller("v1/opd/queue")
export class QueueController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @RequirePermission("appointment:read")
  async queue(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<QueueResponse> {
    const query = queueQuerySchema.parse(rawQuery);
    // Facility-local date treated as a UTC day window in MVP (DB §4 stores UTC).
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const entries = await this.scheduling.queue(principal, {
      facilityId: query.facilityId,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      dayStart,
      dayEnd,
    });
    return {
      facilityId: query.facilityId,
      departmentId: query.departmentId ?? null,
      date,
      entries: entries.map((e, i) => ({
        appointmentId: e.appointmentId,
        patientId: e.patientId,
        patientName: e.patientName,
        practitionerId: e.practitionerId,
        practitionerName: e.practitionerName,
        queueToken: e.queueToken,
        position: i + 1,
        priority: e.priority,
        status: e.status,
        startAt: e.startAt.toISOString(),
        checkedInAt: e.checkedInAt.toISOString(),
      })),
    };
  }
}
