/**
 * Availability + computed-slots endpoints (Stage 4). Templates are admin config
 * (`schedule:manage`); slots are computed on demand (`schedule:read`). Slots are
 * advisory — the DB exclusion constraint remains authoritative.
 */
import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Body, Query } from "@nestjs/common";
import {
  createAvailabilityRequestSchema,
  slotsQuerySchema,
  type AvailabilityResponse,
  type ListAvailabilityResponse,
  type SlotsResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { z } from "zod";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { SchedulingService } from "../application/scheduling.service";
import type { AvailabilityView } from "../ports/scheduling-repository.port";

function toAvailabilityResponse(v: AvailabilityView): AvailabilityResponse {
  return {
    id: v.id,
    practitionerId: v.practitionerId,
    facilityId: v.facilityId,
    dayOfWeek: v.dayOfWeek,
    startTime: v.startTime,
    endTime: v.endTime,
    slotMinutes: v.slotMinutes,
    validFrom: v.validFrom,
    validUntil: v.validUntil,
    version: v.version,
    createdAt: v.createdAt.toISOString(),
  };
}

const listAvailabilityQuerySchema = z.object({ practitionerId: z.string().uuid() });

@Controller("v1/practitioner-availability")
export class AvailabilityController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Post()
  @HttpCode(201)
  @RequirePermission("schedule:manage")
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<AvailabilityResponse> {
    const request = createAvailabilityRequestSchema.parse(rawBody);
    return toAvailabilityResponse(await this.scheduling.createAvailability(principal, request));
  }

  @Get()
  @RequirePermission("schedule:read")
  async list(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListAvailabilityResponse> {
    const parsed = listAvailabilityQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new DomainError("practitionerId query parameter is required");
    const views = await this.scheduling.listAvailability(principal, parsed.data.practitionerId);
    return { data: views.map(toAvailabilityResponse) };
  }
}

@Controller("v1/practitioners")
export class SlotsController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get(":id/slots")
  @RequirePermission("schedule:read")
  async slots(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() rawQuery: unknown,
  ): Promise<SlotsResponse> {
    const { date } = slotsQuerySchema.parse(rawQuery);
    const slots = await this.scheduling.slots(principal, id, date);
    return {
      practitionerId: id,
      date,
      slots: slots.map((s) => ({ startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString() })),
    };
  }
}
