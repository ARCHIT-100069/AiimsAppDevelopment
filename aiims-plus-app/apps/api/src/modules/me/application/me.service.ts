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
  insertOutboxEvent,
  isExclusionViolation,
  newId,
  type AppointmentRow,
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
}
