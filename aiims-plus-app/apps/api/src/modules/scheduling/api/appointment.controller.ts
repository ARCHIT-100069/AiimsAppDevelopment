/**
 * Appointment endpoints (Stage 4). HTTP-only (BDR-0001): validate via
 * api-contracts, call ONE application service, map domain → DTO. Double-booking
 * surfaces as 409 (DB exclusion constraint); reschedule/cancel/no-show use
 * If-Match; book + check-in require Idempotency-Key.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  cancelAppointmentRequestSchema,
  createAppointmentRequestSchema,
  searchAppointmentsQuerySchema,
  updateAppointmentRequestSchema,
  type AppointmentResponse,
  type CheckInResponse,
  type ListAppointmentsResponse,
  type SpecialtyCoding,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { SchedulingService } from "../application/scheduling.service";
import type { Appointment } from "../domain/appointment";

export function toAppointmentResponse(a: Appointment): AppointmentResponse {
  const p = a.props;
  return {
    id: p.id,
    patientId: p.patientId,
    practitionerId: p.practitionerId,
    facilityId: p.facilityId,
    departmentId: p.departmentId,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt.toISOString(),
    status: p.status,
    appointmentType: p.appointmentType,
    specialties: p.specialties as SpecialtyCoding[],
    reasonText: p.reasonText,
    priority: p.priority,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
  };
}

function requireIdempotencyKey(key: string | undefined): string {
  if (!key || key.length < 8 || key.length > 128) {
    throw new DomainError("Idempotency-Key header is required (8–128 chars) — APDR-0006");
  }
  return key;
}

function requireIfMatch(ifMatch: string | undefined): number {
  const expectedVersion = Number(ifMatch);
  if (!ifMatch || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new DomainError("If-Match header with the current version is required (APDR-0006)");
  }
  return expectedVersion;
}

@Controller("v1/appointments")
export class AppointmentController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Post()
  @RequirePermission("appointment:manage")
  async book(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AppointmentResponse> {
    const key = requireIdempotencyKey(idempotencyKey);
    const request = createAppointmentRequestSchema.parse(rawBody);
    const { appointment, created } = await this.scheduling.book(principal, request, key);
    res.status(created ? 201 : 200);
    return toAppointmentResponse(appointment);
  }

  @Get(":id")
  @RequirePermission("appointment:read")
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.scheduling.getById(principal, id));
  }

  @Patch(":id")
  @RequirePermission("appointment:manage")
  async reschedule(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<AppointmentResponse> {
    const expectedVersion = requireIfMatch(ifMatch);
    const request = updateAppointmentRequestSchema.parse(rawBody);
    return toAppointmentResponse(
      await this.scheduling.reschedule(principal, id, expectedVersion, request),
    );
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermission("appointment:manage")
  async cancel(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<AppointmentResponse> {
    const expectedVersion = requireIfMatch(ifMatch);
    const { reason } = cancelAppointmentRequestSchema.parse(rawBody ?? {});
    return toAppointmentResponse(
      await this.scheduling.cancel(principal, id, expectedVersion, reason),
    );
  }

  @Post(":id/no-show")
  @HttpCode(200)
  @RequirePermission("appointment:manage")
  async noShow(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<AppointmentResponse> {
    const expectedVersion = requireIfMatch(ifMatch);
    return toAppointmentResponse(await this.scheduling.noShow(principal, id, expectedVersion));
  }

  @Post(":id/check-in")
  @HttpCode(200)
  @RequirePermission("appointment:checkin")
  async checkIn(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CheckInResponse> {
    const key = requireIdempotencyKey(idempotencyKey);
    const { appointment, encounterId, queueToken } = await this.scheduling.checkIn(
      principal,
      id,
      key,
    );
    return { ...toAppointmentResponse(appointment), encounterId, queueToken };
  }

  @Get()
  @RequirePermission("appointment:read")
  @HttpCode(200)
  async search(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListAppointmentsResponse> {
    const query = searchAppointmentsQuerySchema.parse(rawQuery);
    const results = await this.scheduling.search(principal, {
      limit: query.limit,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.practitionerId ? { practitionerId: query.practitionerId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(toKeyset(query.cursor) ? { cursor: toKeyset(query.cursor)! } : {}),
    });
    const filtered = Boolean(
      query.patientId || query.practitionerId || query.departmentId || query.from || query.to,
    );
    return {
      data: results.map(toAppointmentResponse),
      meta: {
        nextCursor: filtered
          ? null
          : nextCursorFrom(
              results.map((r) => ({ createdAt: r.props.createdAt, id: r.props.id })),
              query.limit,
            ),
      },
    };
  }
}
