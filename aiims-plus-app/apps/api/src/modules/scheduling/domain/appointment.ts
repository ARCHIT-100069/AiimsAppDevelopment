/**
 * Appointment aggregate (Master Plan §14) — pure, framework-free (BDR-0001).
 * Holds the OPD lifecycle state machine; the DB slot-exclusion constraint (not
 * this code) is the authority on double-booking. Times are UTC instants.
 */

export interface SpecialtyCoding {
  system: string;
  code: string;
  display: string;
}

export type AppointmentStatus =
  "booked" | "checked_in" | "in_progress" | "fulfilled" | "cancelled" | "no_show";

export type AppointmentType = "routine" | "walk_in" | "follow_up";

export interface AppointmentProps {
  readonly id: string;
  readonly tenantId: string;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly facilityId: string;
  readonly departmentId: string | null;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: AppointmentStatus;
  readonly appointmentType: AppointmentType;
  readonly specialties: SpecialtyCoding[];
  readonly reasonText: string | null;
  readonly priority: number;
  readonly queueToken: number | null;
  readonly version: number;
  readonly createdAt: Date;
}

export class InvalidAppointmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAppointmentError";
  }
}

/** Legal state transitions (from → allowed targets). Everything else is rejected. */
const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  booked: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_progress", "cancelled"],
  in_progress: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
  no_show: [],
};

export interface AppointmentChanges {
  startAt?: Date;
  endAt?: Date;
  departmentId?: string | null;
  appointmentType?: AppointmentType;
  specialties?: SpecialtyCoding[];
  reasonText?: string | null;
  priority?: number;
}

export class Appointment {
  private constructor(readonly props: AppointmentProps) {}

  static book(input: {
    id: string;
    tenantId: string;
    patientId: string;
    practitionerId: string;
    facilityId: string;
    departmentId?: string | null;
    startAt: Date;
    endAt: Date;
    appointmentType: AppointmentType;
    specialties?: SpecialtyCoding[];
    reasonText?: string | null;
    priority?: number;
  }): Appointment {
    if (input.endAt.getTime() <= input.startAt.getTime()) {
      throw new InvalidAppointmentError("endAt must be after startAt");
    }
    return new Appointment({
      id: input.id,
      tenantId: input.tenantId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      departmentId: input.departmentId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "booked",
      appointmentType: input.appointmentType,
      specialties: input.specialties ?? [],
      reasonText: input.reasonText ?? null,
      priority: input.priority ?? 0,
      queueToken: null,
      version: 0,
      createdAt: new Date(),
    });
  }

  /** Guard a status transition; throws if illegal from the current state. */
  assertCanTransition(target: AppointmentStatus): void {
    if (!TRANSITIONS[this.props.status].includes(target)) {
      throw new InvalidAppointmentError(
        `Cannot move appointment from "${this.props.status}" to "${target}"`,
      );
    }
  }

  /** Reschedule/edit — only meaningful while the appointment is still active. */
  assertReschedulable(): void {
    if (this.props.status !== "booked" && this.props.status !== "checked_in") {
      throw new InvalidAppointmentError(
        `Cannot reschedule an appointment in status "${this.props.status}"`,
      );
    }
  }

  validateChanges(changes: AppointmentChanges): void {
    const start = changes.startAt ?? this.props.startAt;
    const end = changes.endAt ?? this.props.endAt;
    if (end.getTime() <= start.getTime()) {
      throw new InvalidAppointmentError("endAt must be after startAt");
    }
  }

  static fromPersistence(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }
}
