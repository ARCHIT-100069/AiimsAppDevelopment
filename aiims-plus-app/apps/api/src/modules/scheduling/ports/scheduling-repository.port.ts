/**
 * Scheduling repository port (BDR-0003) — domain-owned, returns domain objects.
 * `DataContext` stays opaque (the tenant-scoped transaction). Drizzle never
 * leaks past the infrastructure implementation.
 */
import type { Appointment, AppointmentChanges, AppointmentStatus } from "../domain/appointment";
import type { Encounter } from "../domain/encounter";

export type DataContext = unknown;

export interface AppointmentSearch {
  patientId?: string;
  practitionerId?: string;
  departmentId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: { beforeCreatedAt: Date; beforeId: string };
}

export interface AvailabilityInput {
  practitionerId: string;
  facilityId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface AvailabilityView {
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
}

export interface Slot {
  startAt: Date;
  endAt: Date;
}

export interface QueueEntryView {
  appointmentId: string;
  patientId: string;
  patientName: string | null;
  practitionerId: string;
  practitionerName: string | null;
  queueToken: number;
  priority: number;
  status: "checked_in" | "in_progress";
  startAt: Date;
  checkedInAt: Date;
}

export interface SchedulingRepository {
  // appointments
  insertAppointment(ctx: DataContext, appointment: Appointment): Promise<void>;
  findAppointmentById(ctx: DataContext, id: string): Promise<Appointment | undefined>;
  searchAppointments(ctx: DataContext, query: AppointmentSearch): Promise<Appointment[]>;
  rescheduleAppointment(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: AppointmentChanges,
  ): Promise<Appointment | "conflict" | "missing">;
  transitionAppointment(
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
  ): Promise<Appointment | "conflict">;

  // encounters
  insertEncounter(ctx: DataContext, encounter: Encounter): Promise<void>;
  findEncounterById(ctx: DataContext, id: string): Promise<Encounter | undefined>;
  findEncounterByAppointmentId(
    ctx: DataContext,
    appointmentId: string,
  ): Promise<Encounter | undefined>;

  // queue token
  issueQueueToken(
    ctx: DataContext,
    input: {
      tenantId: string;
      facilityId: string;
      departmentId?: string | null;
      serviceDate: string;
    },
  ): Promise<number>;

  // availability + slots + queue
  insertAvailability(
    ctx: DataContext,
    tenantId: string,
    input: AvailabilityInput,
  ): Promise<AvailabilityView>;
  listAvailability(ctx: DataContext, practitionerId: string): Promise<AvailabilityView[]>;
  computeFreeSlots(ctx: DataContext, practitionerId: string, date: string): Promise<Slot[]>;
  queue(
    ctx: DataContext,
    input: { facilityId: string; departmentId?: string | null; dayStart: Date; dayEnd: Date },
  ): Promise<QueueEntryView[]>;
}

export const SCHEDULING_REPOSITORY = Symbol("SCHEDULING_REPOSITORY");
