/**
 * Scheduling application service — the transaction boundary (BDR-0004).
 * Every mutation is ONE tenant-scoped tx: row + outbox event(s) + audit row(s),
 * atomic. Double-booking is caught by the DB slot-exclusion constraint (23P01)
 * and surfaced as 409; optimistic concurrency (version + If-Match) is a distinct
 * 409. Check-in is idempotent (APDR-0006) and opens the clinical encounter.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateAppointmentRequest,
  CreateAvailabilityRequest,
  UpdateAppointmentRequest,
} from "@aiims/api-contracts";
import {
  findIdempotentResource,
  insertOutboxEvent,
  isExclusionViolation,
  isForeignKeyViolation,
  isUniqueViolation,
  newId,
  saveIdempotencyKey,
  type Keyset,
  type TenantDb,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import {
  APPOINTMENT_BOOKED_V1,
  APPOINTMENT_CANCELLED_V1,
  APPOINTMENT_CHECKED_IN_V1,
  APPOINTMENT_NO_SHOW_V1,
  APPOINTMENT_RESCHEDULED_V1,
  ENCOUNTER_OPENED_V1,
} from "@aiims/event-schemas";
import { ConflictError, DomainError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";
import { Appointment, InvalidAppointmentError } from "../domain/appointment";
import { Encounter } from "../domain/encounter";
import type { AvailabilityView, QueueEntryView, Slot } from "../ports/scheduling-repository.port";
import {
  SCHEDULING_REPOSITORY,
  type SchedulingRepository,
} from "../ports/scheduling-repository.port";

const BOOK_ENDPOINT = "POST /v1/appointments";
const CHECKIN_ENDPOINT = "POST /v1/appointments/check-in";

const utcDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface BookResult {
  appointment: Appointment;
  created: boolean;
}
export interface CheckInResult {
  appointment: Appointment;
  encounterId: string;
  queueToken: number;
}

@Injectable()
export class SchedulingService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(SCHEDULING_REPOSITORY) private readonly repo: SchedulingRepository,
  ) {}

  async book(
    principal: Principal,
    req: CreateAppointmentRequest,
    idempotencyKey: string,
  ): Promise<BookResult> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const existingId = await findIdempotentResource(db, BOOK_ENDPOINT, idempotencyKey);
        if (existingId) {
          const existing = await this.repo.findAppointmentById(db, existingId);
          if (!existing) throw new ConflictError("Idempotency key maps to a missing resource");
          return { appointment: existing, created: false };
        }

        let appointment: Appointment;
        try {
          appointment = Appointment.book({
            id: newId(),
            tenantId: principal.tenantId,
            patientId: req.patientId,
            practitionerId: req.practitionerId,
            facilityId: req.facilityId,
            departmentId: req.departmentId ?? null,
            startAt: new Date(req.startAt),
            endAt: new Date(req.endAt),
            appointmentType: req.appointmentType,
            specialties: req.specialties,
            reasonText: req.reasonText ?? null,
            priority: req.priority,
          });
        } catch (err) {
          if (err instanceof InvalidAppointmentError) throw new DomainError(err.message);
          throw err;
        }

        await this.repo.insertAppointment(db, appointment);

        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "appointment",
          aggregateId: appointment.props.id,
          eventType: APPOINTMENT_BOOKED_V1,
          payload: {
            appointmentId: appointment.props.id,
            patientId: appointment.props.patientId,
            practitionerId: appointment.props.practitionerId,
          },
        });
        await this.audit.append(db, actor, {
          eventId,
          action: "appointment.book",
          resourceType: "appointment",
          resourceId: appointment.props.id,
          occurredAt: new Date(),
        });
        await saveIdempotencyKey(db, {
          tenantId: principal.tenantId,
          endpoint: BOOK_ENDPOINT,
          key: idempotencyKey,
          resourceId: appointment.props.id,
        });
        return { appointment, created: true };
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictError(
          "That time slot overlaps an existing appointment for this practitioner",
        );
      }
      if (isUniqueViolation(err)) {
        throw new ConflictError("A booking with this idempotency key is already in progress");
      }
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError(
          "Patient, practitioner, department, or facility not found in this tenant",
        );
      }
      throw err;
    }
  }

  async getById(principal: Principal, id: string): Promise<Appointment> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const appointment = await this.repo.findAppointmentById(db, id);
      if (!appointment) throw new NotFoundError("Appointment not found");
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "appointment.read",
        resourceType: "appointment",
        resourceId: id,
        occurredAt: new Date(),
      });
      return appointment;
    });
  }

  async search(
    principal: Principal,
    input: {
      patientId?: string;
      practitionerId?: string;
      departmentId?: string;
      from?: Date;
      to?: Date;
      limit: number;
      cursor?: Keyset;
    },
  ): Promise<Appointment[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const results = await this.repo.searchAppointments(db, {
        limit: input.limit,
        ...(input.patientId ? { patientId: input.patientId } : {}),
        ...(input.practitionerId ? { practitionerId: input.practitionerId } : {}),
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        ...(input.from ? { from: input.from } : {}),
        ...(input.to ? { to: input.to } : {}),
        ...(input.cursor ? { cursor: input.cursor } : {}),
      });
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "appointment.search",
        resourceType: "appointment",
        resourceId: principal.tenantId,
        occurredAt: new Date(),
      });
      return results;
    });
  }

  async reschedule(
    principal: Principal,
    id: string,
    expectedVersion: number,
    req: UpdateAppointmentRequest,
  ): Promise<Appointment> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const current = await this.repo.findAppointmentById(db, id);
        if (!current) throw new NotFoundError("Appointment not found");
        try {
          current.assertReschedulable();
          current.validateChanges({
            ...(req.startAt !== undefined ? { startAt: new Date(req.startAt) } : {}),
            ...(req.endAt !== undefined ? { endAt: new Date(req.endAt) } : {}),
          });
        } catch (err) {
          if (err instanceof InvalidAppointmentError) throw new DomainError(err.message);
          throw err;
        }

        const result = await this.repo.rescheduleAppointment(db, id, expectedVersion, {
          ...(req.startAt !== undefined ? { startAt: new Date(req.startAt) } : {}),
          ...(req.endAt !== undefined ? { endAt: new Date(req.endAt) } : {}),
          ...(req.departmentId !== undefined ? { departmentId: req.departmentId } : {}),
          ...(req.appointmentType !== undefined ? { appointmentType: req.appointmentType } : {}),
          ...(req.specialties !== undefined ? { specialties: req.specialties } : {}),
          ...(req.reasonText !== undefined ? { reasonText: req.reasonText } : {}),
          ...(req.priority !== undefined ? { priority: req.priority } : {}),
        });
        if (result === "missing") throw new NotFoundError("Appointment not found");
        if (result === "conflict") {
          throw new ConflictError("Appointment was modified concurrently — refetch and retry");
        }

        await this.emitUpdate(
          db,
          actor,
          id,
          APPOINTMENT_RESCHEDULED_V1,
          "appointment.reschedule",
          result.props.version,
        );
        return result;
      });
    } catch (err) {
      if (isExclusionViolation(err)) {
        throw new ConflictError(
          "The new time overlaps an existing appointment for this practitioner",
        );
      }
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError("Department not found in this tenant");
      }
      throw err;
    }
  }

  async cancel(
    principal: Principal,
    id: string,
    expectedVersion: number,
    reason?: string,
  ): Promise<Appointment> {
    return this.transition(principal, id, expectedVersion, "cancelled", {
      event: APPOINTMENT_CANCELLED_V1,
      action: "appointment.cancel",
      cancelReason: reason ?? null,
    });
  }

  async noShow(principal: Principal, id: string, expectedVersion: number): Promise<Appointment> {
    return this.transition(principal, id, expectedVersion, "no_show", {
      event: APPOINTMENT_NO_SHOW_V1,
      action: "appointment.no_show",
    });
  }

  async checkIn(principal: Principal, id: string, idempotencyKey: string): Promise<CheckInResult> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const current = await this.repo.findAppointmentById(db, id);
      if (!current) throw new NotFoundError("Appointment not found");

      // Idempotent replay (APDR-0006): return the already-opened encounter.
      const existingId = await findIdempotentResource(db, CHECKIN_ENDPOINT, idempotencyKey);
      if (existingId) {
        const enc = await this.repo.findEncounterByAppointmentId(db, id);
        if (!enc) throw new ConflictError("Idempotency key maps to a missing encounter");
        return {
          appointment: current,
          encounterId: enc.props.id,
          queueToken: current.props.queueToken ?? 0,
        };
      }

      try {
        current.assertCanTransition("checked_in");
      } catch (err) {
        if (err instanceof InvalidAppointmentError) throw new ConflictError(err.message);
        throw err;
      }

      const queueToken = await this.repo.issueQueueToken(db, {
        tenantId: principal.tenantId,
        facilityId: current.props.facilityId,
        departmentId: current.props.departmentId,
        serviceDate: utcDate(current.props.startAt),
      });

      const checkedIn = await this.repo.transitionAppointment(
        db,
        id,
        current.props.version,
        "booked",
        { status: "checked_in", queueToken, checkedIn: true },
      );
      if (checkedIn === "conflict") {
        throw new ConflictError("Appointment was already checked in or modified — refetch");
      }

      const encounter = Encounter.open({
        id: newId(),
        tenantId: principal.tenantId,
        appointmentId: id,
        patientId: current.props.patientId,
        practitionerId: current.props.practitionerId,
        facilityId: current.props.facilityId,
        departmentId: current.props.departmentId,
      });
      await this.repo.insertEncounter(db, encounter);

      const checkinEventId = newId();
      await insertOutboxEvent(db, {
        id: checkinEventId,
        tenantId: principal.tenantId,
        aggregateType: "appointment",
        aggregateId: id,
        eventType: APPOINTMENT_CHECKED_IN_V1,
        payload: { appointmentId: id, encounterId: encounter.props.id, queueToken },
      });
      await this.audit.append(db, actor, {
        eventId: checkinEventId,
        action: "appointment.check_in",
        resourceType: "appointment",
        resourceId: id,
        occurredAt: new Date(),
      });

      const encounterEventId = newId();
      await insertOutboxEvent(db, {
        id: encounterEventId,
        tenantId: principal.tenantId,
        aggregateType: "encounter",
        aggregateId: encounter.props.id,
        eventType: ENCOUNTER_OPENED_V1,
        payload: {
          encounterId: encounter.props.id,
          appointmentId: id,
          patientId: current.props.patientId,
          practitionerId: current.props.practitionerId,
        },
      });
      await this.audit.append(db, actor, {
        eventId: encounterEventId,
        action: "encounter.open",
        resourceType: "encounter",
        resourceId: encounter.props.id,
        occurredAt: new Date(),
      });

      await saveIdempotencyKey(db, {
        tenantId: principal.tenantId,
        endpoint: CHECKIN_ENDPOINT,
        key: idempotencyKey,
        resourceId: id,
      });

      return { appointment: checkedIn, encounterId: encounter.props.id, queueToken };
    });
  }

  /* --------------------------- availability / slots / queue --------------------------- */

  async createAvailability(
    principal: Principal,
    req: CreateAvailabilityRequest,
  ): Promise<AvailabilityView> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const view = await this.repo.insertAvailability(db, principal.tenantId, req);
        await this.audit.append(db, actor, {
          eventId: newId(),
          action: "availability.create",
          resourceType: "practitioner_availability",
          resourceId: view.id,
          occurredAt: new Date(),
        });
        return view;
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError("Practitioner or facility not found in this tenant");
      }
      throw err;
    }
  }

  async listAvailability(
    principal: Principal,
    practitionerId: string,
  ): Promise<AvailabilityView[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, (db) => this.repo.listAvailability(db, practitionerId));
  }

  async slots(principal: Principal, practitionerId: string, date: string): Promise<Slot[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, (db) => this.repo.computeFreeSlots(db, practitionerId, date));
  }

  async queue(
    principal: Principal,
    input: { facilityId: string; departmentId?: string; dayStart: Date; dayEnd: Date },
  ): Promise<QueueEntryView[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const entries = await this.repo.queue(db, {
        facilityId: input.facilityId,
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        dayStart: input.dayStart,
        dayEnd: input.dayEnd,
      });
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "opd.queue.read",
        resourceType: "appointment",
        resourceId: principal.tenantId,
        occurredAt: new Date(),
      });
      return entries;
    });
  }

  async getEncounterById(principal: Principal, id: string): Promise<Encounter> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const encounter = await this.repo.findEncounterById(db, id);
      if (!encounter) throw new NotFoundError("Encounter not found");
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "encounter.read",
        resourceType: "encounter",
        resourceId: id,
        occurredAt: new Date(),
      });
      return encounter;
    });
  }

  /* -------------------------------- helpers -------------------------------- */

  private async transition(
    principal: Principal,
    id: string,
    expectedVersion: number,
    target: "cancelled" | "no_show",
    meta: { event: string; action: string; cancelReason?: string | null },
  ): Promise<Appointment> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const current = await this.repo.findAppointmentById(db, id);
      if (!current) throw new NotFoundError("Appointment not found");
      try {
        current.assertCanTransition(target);
      } catch (err) {
        if (err instanceof InvalidAppointmentError) throw new ConflictError(err.message);
        throw err;
      }
      const result = await this.repo.transitionAppointment(
        db,
        id,
        expectedVersion,
        current.props.status,
        {
          status: target,
          ...(meta.cancelReason !== undefined ? { cancelReason: meta.cancelReason } : {}),
        },
      );
      if (result === "conflict") {
        throw new ConflictError("Appointment was modified concurrently — refetch and retry");
      }
      await this.emitUpdate(db, actor, id, meta.event, meta.action, result.props.version);
      return result;
    });
  }

  private async emitUpdate(
    db: TenantDb,
    actor: { tenantId: string; actorId: string },
    id: string,
    eventType: string,
    action: string,
    version: number,
  ): Promise<void> {
    const eventId = newId();
    await insertOutboxEvent(db, {
      id: eventId,
      tenantId: actor.tenantId,
      aggregateType: "appointment",
      aggregateId: id,
      eventType,
      payload: { appointmentId: id, version },
    });
    await this.audit.append(db, actor, {
      eventId,
      action,
      resourceType: "appointment",
      resourceId: id,
      occurredAt: new Date(),
    });
  }
}
