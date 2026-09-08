/**
 * Patient portal ("me") — self-service. A patient sees and acts on ONLY their
 * own record: every endpoint is scoped to the token's `patientId` AND runs
 * inside the patient's tenant RLS context. Reads need `self:read`; booking
 * needs `self:book`. Booking (MeService) writes an appointment + outbox event +
 * audit in one transaction, forcing the patient id from the token — never the
 * request body.
 */
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { computeFreeSlots, listBookablePractitioners } from "@aiims/db";
import {
  bookMyAppointmentRequestSchema,
  createFeedbackRequestSchema,
  type BookableOptionsResponse,
  type FeedbackResponse,
  type MyAppointment,
  type MyQueuePosition,
  type MySummaryResponse,
  type SlotsResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { UnitOfWork } from "../../../platform/db.provider";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { buildPatientChart } from "../../../common/patient-chart";
import { MeService } from "../application/me.service";

const VISIT_MINUTES = 15;

@Controller("v1/me")
export class MeController {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly me: MeService,
  ) {}

  @Get("summary")
  @RequirePermission("self:read")
  async summary(@CurrentPrincipal() principal: Principal): Promise<MySummaryResponse> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");

    return this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      async (db) => {
        const chart = await buildPatientChart(db, patientId, true);
        if (!chart) throw new NotFoundError("Patient not found");
        return chart;
      },
    );
  }

  @Get("practitioners")
  @RequirePermission("self:read")
  async practitioners(@CurrentPrincipal() principal: Principal): Promise<BookableOptionsResponse> {
    const practitioners = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => listBookablePractitioners(db),
    );
    return { practitioners };
  }

  @Get("slots")
  @RequirePermission("self:read")
  async slots(
    @CurrentPrincipal() principal: Principal,
    @Query("practitionerId") practitionerId?: string,
    @Query("date") date?: string,
  ): Promise<SlotsResponse> {
    const uuid = /^[0-9a-f-]{36}$/i;
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!practitionerId || !uuid.test(practitionerId) || !date || !day.test(date)) {
      return { practitionerId: practitionerId ?? "", date: date ?? "", slots: [] };
    }
    const slots = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => computeFreeSlots(db, practitionerId, date),
    );
    return {
      practitionerId,
      date,
      slots: slots.map((s) => ({ startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString() })),
    };
  }

  @Get("queue-position")
  @RequirePermission("self:read")
  async queuePosition(@CurrentPrincipal() principal: Principal): Promise<MyQueuePosition> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");
    return this.me.queuePosition(principal, patientId);
  }

  @Post("appointments")
  @HttpCode(201)
  @RequirePermission("self:book")
  async book(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<MyAppointment> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");
    const req = bookMyAppointmentRequestSchema.parse(rawBody);

    const start = new Date(req.startAt);
    const end = new Date(start.getTime() + VISIT_MINUTES * 60_000);

    // The patient id comes from the TOKEN — a patient can only book for self.
    const a = await this.me.book(principal, {
      patientId,
      practitionerId: req.practitionerId,
      facilityId: req.facilityId,
      departmentId: req.departmentId,
      startAt: start,
      endAt: end,
      reasonText: req.reasonText,
    });

    return {
      id: a.id,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      appointmentType: a.appointmentType,
      reasonText: a.reasonText ?? null,
    };
  }

  @Post("feedback")
  @HttpCode(201)
  @RequirePermission("self:feedback")
  async submitFeedback(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<FeedbackResponse> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");
    const req = createFeedbackRequestSchema.parse(rawBody);

    // The patient id comes from the TOKEN — a patient rates only their own care.
    const row = await this.me.submitFeedback(principal, {
      patientId,
      rating: req.rating,
      category: req.category,
      comment: req.comment,
      encounterId: req.encounterId,
    });

    return {
      id: row.id,
      rating: row.rating,
      category: row.category,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
