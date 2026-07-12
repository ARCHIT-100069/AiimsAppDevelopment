/**
 * Patient-portal application service. Booking goes through the same primitives
 * as staff scheduling — insert appointment + transactional outbox event +
 * tamper-evident audit, all in one tenant transaction — but the patient id is
 * always the caller's own (from the token). Double-booking is caught by the DB
 * exclusion constraint (23P01 → 409).
 */
import { Injectable } from "@nestjs/common";
import {
  insertAppointment,
  insertFeedback,
  insertOutboxEvent,
  isExclusionViolation,
  newId,
  type AppointmentRow,
  type FeedbackRow,
} from "@aiims/db";
import { APPOINTMENT_BOOKED_V1 } from "@aiims/event-schemas";
import type { Principal } from "@aiims/domain-types";
import { ConflictError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

export interface SelfBookInput {
  patientId: string;
  practitionerId: string;
  facilityId: string;
  departmentId?: string;
  startAt: Date;
  endAt: Date;
  reasonText?: string;
}

export interface SelfFeedbackInput {
  patientId: string;
  rating: number;
  category: string;
  comment?: string;
  encounterId?: string;
}

@Injectable()
export class MeService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  async book(principal: Principal, input: SelfBookInput): Promise<AppointmentRow> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const appointment = await insertAppointment(db, {
          id: newId(),
          tenantId: principal.tenantId,
          patientId: input.patientId,
          practitionerId: input.practitionerId,
          facilityId: input.facilityId,
          departmentId: input.departmentId ?? null,
          startAt: input.startAt,
          endAt: input.endAt,
          appointmentType: "routine",
          specialties: [],
          reasonText: input.reasonText ?? null,
          priority: 0,
        });

        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "appointment",
          aggregateId: appointment.id,
          eventType: APPOINTMENT_BOOKED_V1,
          payload: {
            appointmentId: appointment.id,
            patientId: appointment.patientId,
            practitionerId: appointment.practitionerId,
            bookedByPatient: true,
          },
        });
        await this.audit.append(db, actor, {
          eventId,
          action: "appointment.book",
          resourceType: "appointment",
          resourceId: appointment.id,
          occurredAt: new Date(),
        });
        return appointment;
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictError("That time slot is no longer available — please pick another.");
      }
      throw err;
    }
  }

  /**
   * A patient submits satisfaction feedback about their own care. Append-only:
   * insert + tamper-evident audit in one tenant transaction. The patient id is
   * always the caller's own (from the token) — never the request body.
   */
  async submitFeedback(principal: Principal, input: SelfFeedbackInput): Promise<FeedbackRow> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const row = await insertFeedback(db, {
        id: newId(),
        tenantId: principal.tenantId,
        patientId: input.patientId,
        encounterId: input.encounterId ?? null,
        rating: input.rating,
        category: input.category,
        comment: input.comment ?? null,
      });
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "feedback.submit",
        resourceType: "patient_feedback",
        resourceId: row.id,
        occurredAt: new Date(),
      });
      return row;
    });
  }
}
