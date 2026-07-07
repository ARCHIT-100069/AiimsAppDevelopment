/**
 * Scheduling repository implementation: maps domain ↔ rows via @aiims/db
 * helpers (Drizzle stays confined). Always inside a tenant-context transaction.
 */
import { Injectable } from "@nestjs/common";
import {
  computeFreeSlots,
  getAppointmentById,
  getEncounterById,
  getEncounterByAppointmentId,
  insertAppointment,
  insertAvailability,
  insertEncounter,
  issueQueueToken,
  listAvailabilityByPractitioner,
  newId,
  queueEntries,
  searchAppointments,
  transitionAppointmentVersioned,
  updateAppointmentVersioned,
  type AppointmentRow,
  type EncounterRow,
  type TenantDb,
} from "@aiims/db";
import {
  Appointment,
  type AppointmentChanges,
  type AppointmentStatus,
  type SpecialtyCoding,
} from "../domain/appointment";
import { Encounter } from "../domain/encounter";
import type {
  AvailabilityInput,
  AvailabilityView,
  DataContext,
  QueueEntryView,
  SchedulingRepository,
  Slot,
  AppointmentSearch,
} from "../ports/scheduling-repository.port";

@Injectable()
export class DrizzleSchedulingRepository implements SchedulingRepository {
  async insertAppointment(ctx: DataContext, a: Appointment): Promise<void> {
    const p = a.props;
    await insertAppointment(ctx as TenantDb, {
      id: p.id,
      tenantId: p.tenantId,
      patientId: p.patientId,
      practitionerId: p.practitionerId,
      facilityId: p.facilityId,
      departmentId: p.departmentId,
      startAt: p.startAt,
      endAt: p.endAt,
      appointmentType: p.appointmentType,
      specialties: p.specialties,
      reasonText: p.reasonText,
      priority: p.priority,
    });
  }

  async findAppointmentById(ctx: DataContext, id: string): Promise<Appointment | undefined> {
    const row = await getAppointmentById(ctx as TenantDb, id);
    return row ? this.apptToDomain(row) : undefined;
  }

  async searchAppointments(ctx: DataContext, query: AppointmentSearch): Promise<Appointment[]> {
    const rows = await searchAppointments(ctx as TenantDb, {
      limit: query.limit,
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.practitionerId ? { practitionerId: query.practitionerId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    return rows.map((r) => this.apptToDomain(r));
  }

  async rescheduleAppointment(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: AppointmentChanges,
  ): Promise<Appointment | "conflict" | "missing"> {
    const db = ctx as TenantDb;
    const existing = await getAppointmentById(db, id);
    if (!existing) return "missing";
    const updated = await updateAppointmentVersioned(db, id, expectedVersion, {
      ...(changes.startAt !== undefined ? { startAt: changes.startAt } : {}),
      ...(changes.endAt !== undefined ? { endAt: changes.endAt } : {}),
      ...(changes.departmentId !== undefined ? { departmentId: changes.departmentId } : {}),
      ...(changes.appointmentType !== undefined
        ? { appointmentType: changes.appointmentType }
        : {}),
      ...(changes.specialties !== undefined ? { specialties: changes.specialties } : {}),
      ...(changes.reasonText !== undefined ? { reasonText: changes.reasonText } : {}),
      ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    });
    return updated ? this.apptToDomain(updated) : "conflict";
  }

  async transitionAppointment(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    fromStatus: AppointmentStatus,
    to: {
      status: "checked_in" | "in_progress" | "cancelled" | "no_show";
      cancelReason?: string | null;
      queueToken?: number;
      checkedIn?: boolean;
    },
  ): Promise<Appointment | "conflict"> {
    const updated = await transitionAppointmentVersioned(
      ctx as TenantDb,
      id,
      expectedVersion,
      fromStatus,
      to,
    );
    return updated ? this.apptToDomain(updated) : "conflict";
  }

  async insertEncounter(ctx: DataContext, e: Encounter): Promise<void> {
    const p = e.props;
    await insertEncounter(ctx as TenantDb, {
      id: p.id,
      tenantId: p.tenantId,
      appointmentId: p.appointmentId ?? "",
      patientId: p.patientId,
      practitionerId: p.practitionerId,
      facilityId: p.facilityId,
      departmentId: p.departmentId,
    });
  }

  async findEncounterById(ctx: DataContext, id: string): Promise<Encounter | undefined> {
    const row = await getEncounterById(ctx as TenantDb, id);
    return row ? this.encToDomain(row) : undefined;
  }

  async findEncounterByAppointmentId(
    ctx: DataContext,
    appointmentId: string,
  ): Promise<Encounter | undefined> {
    const row = await getEncounterByAppointmentId(ctx as TenantDb, appointmentId);
    return row ? this.encToDomain(row) : undefined;
  }

  async issueQueueToken(
    ctx: DataContext,
    input: {
      tenantId: string;
      facilityId: string;
      departmentId?: string | null;
      serviceDate: string;
    },
  ): Promise<number> {
    return issueQueueToken(ctx as TenantDb, input);
  }

  async insertAvailability(
    ctx: DataContext,
    tenantId: string,
    input: AvailabilityInput,
  ): Promise<AvailabilityView> {
    const row = await insertAvailability(ctx as TenantDb, {
      id: newId(),
      tenantId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      slotMinutes: input.slotMinutes,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    });
    return this.availToView(row);
  }

  async listAvailability(ctx: DataContext, practitionerId: string): Promise<AvailabilityView[]> {
    const rows = await listAvailabilityByPractitioner(ctx as TenantDb, practitionerId);
    return rows.map((r) => this.availToView(r));
  }

  async computeFreeSlots(ctx: DataContext, practitionerId: string, date: string): Promise<Slot[]> {
    return computeFreeSlots(ctx as TenantDb, practitionerId, date);
  }

  async queue(
    ctx: DataContext,
    input: { facilityId: string; departmentId?: string | null; dayStart: Date; dayEnd: Date },
  ): Promise<QueueEntryView[]> {
    const rows = await queueEntries(ctx as TenantDb, input);
    return rows.map((r) => ({
      appointmentId: r.appointmentId,
      patientId: r.patientId,
      patientName: r.patientName,
      practitionerId: r.practitionerId,
      practitionerName: r.practitionerName,
      queueToken: r.queueToken,
      priority: r.priority,
      status: r.status,
      startAt: r.startAt,
      checkedInAt: r.checkedInAt,
    }));
  }

  private apptToDomain(row: AppointmentRow): Appointment {
    return Appointment.fromPersistence({
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      practitionerId: row.practitionerId,
      facilityId: row.facilityId,
      departmentId: row.departmentId,
      startAt: row.startAt,
      endAt: row.endAt,
      status: row.status,
      appointmentType: row.appointmentType,
      specialties: (row.specialtyCodings as SpecialtyCoding[]) ?? [],
      reasonText: row.reasonText,
      priority: row.priority,
      queueToken: row.queueToken,
      version: row.version,
      createdAt: row.createdAt,
    });
  }

  private encToDomain(row: EncounterRow): Encounter {
    return Encounter.fromPersistence({
      id: row.id,
      tenantId: row.tenantId,
      appointmentId: row.appointmentId,
      patientId: row.patientId,
      practitionerId: row.practitionerId,
      facilityId: row.facilityId,
      departmentId: row.departmentId,
      class: row.class,
      status: row.status,
      chiefComplaint: row.chiefComplaint,
      signedAt: row.signedAt,
      signedBy: row.signedBy,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      version: row.version,
      createdAt: row.createdAt,
    });
  }

  private availToView(row: {
    id: string;
    practitionerId: string;
    facilityId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    validFrom: string | null;
    validUntil: string | null;
    version: number;
    createdAt: Date;
  }): AvailabilityView {
    return {
      id: row.id,
      practitionerId: row.practitionerId,
      facilityId: row.facilityId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      slotMinutes: row.slotMinutes,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      version: row.version,
      createdAt: row.createdAt,
    };
  }
}
