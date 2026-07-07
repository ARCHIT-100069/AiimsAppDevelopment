/**
 * Stage 4 data-access helpers (scheduling). Drizzle stays confined here; the
 * repository maps domain ↔ these rows. Every helper requires a tenant-scoped
 * transaction (DDR-0002). Double-booking is enforced by the DB exclusion
 * constraint — inserts/updates that overlap throw 23P01 (isExclusionViolation).
 */
import { and, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Keyset } from "./platform-queries";
import type { SpecialtyCoding } from "./practitioner-queries";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/* ------------------------------ appointment ------------------------------ */

export interface AppointmentRow {
  id: string;
  tenantId: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  departmentId: string | null;
  startAt: Date;
  endAt: Date;
  status: "booked" | "checked_in" | "in_progress" | "fulfilled" | "cancelled" | "no_show";
  appointmentType: "routine" | "walk_in" | "follow_up";
  specialtyCodings: unknown;
  reasonText: string | null;
  priority: number;
  queueToken: number | null;
  version: number;
  createdAt: Date;
}

const apptColumns = {
  id: s.appointment.id,
  tenantId: s.appointment.tenantId,
  patientId: s.appointment.patientId,
  practitionerId: s.appointment.practitionerId,
  facilityId: s.appointment.facilityId,
  departmentId: s.appointment.departmentId,
  startAt: s.appointment.startAt,
  endAt: s.appointment.endAt,
  status: s.appointment.status,
  appointmentType: s.appointment.appointmentType,
  specialtyCodings: s.appointment.specialtyCodings,
  reasonText: s.appointment.reasonText,
  priority: s.appointment.priority,
  queueToken: s.appointment.queueToken,
  version: s.appointment.version,
  createdAt: s.appointment.createdAt,
} as const;

const apptNotDeleted = isNull(s.appointment.deletedAt);

export interface InsertAppointmentInput {
  id: string;
  tenantId: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  departmentId?: string | null;
  startAt: Date;
  endAt: Date;
  appointmentType: "routine" | "walk_in" | "follow_up";
  specialties: SpecialtyCoding[];
  reasonText?: string | null;
  priority: number;
}

export async function insertAppointment(
  db: TenantDb,
  input: InsertAppointmentInput,
): Promise<AppointmentRow> {
  const primary = input.specialties[0];
  const [row] = await db
    .insert(s.appointment)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      departmentId: input.departmentId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
      appointmentType: input.appointmentType,
      specialtySystem: primary?.system ?? null,
      specialtyCode: primary?.code ?? null,
      specialtyDisplay: primary?.display ?? null,
      specialtyCodings: input.specialties,
      reasonText: input.reasonText ?? null,
      priority: input.priority,
    })
    .returning(apptColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getAppointmentById(
  db: TenantDb,
  id: string,
): Promise<AppointmentRow | undefined> {
  const [row] = await db
    .select(apptColumns)
    .from(s.appointment)
    .where(and(eq(s.appointment.id, id), apptNotDeleted))
    .limit(1);
  return row;
}

export interface SearchAppointmentsFilters {
  patientId?: string;
  practitionerId?: string;
  departmentId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  cursor?: Keyset;
}

export async function searchAppointments(
  db: TenantDb,
  f: SearchAppointmentsFilters,
): Promise<AppointmentRow[]> {
  const filtered = Boolean(f.patientId || f.practitionerId || f.departmentId || f.from || f.to);
  const conds = [
    apptNotDeleted,
    f.patientId ? eq(s.appointment.patientId, f.patientId) : undefined,
    f.practitionerId ? eq(s.appointment.practitionerId, f.practitionerId) : undefined,
    f.departmentId ? eq(s.appointment.departmentId, f.departmentId) : undefined,
    f.from ? gte(s.appointment.startAt, f.from) : undefined,
    f.to ? lt(s.appointment.startAt, f.to) : undefined,
  ];

  if (filtered) {
    // Schedule/day views: chronological, bounded (no cursor).
    return db
      .select(apptColumns)
      .from(s.appointment)
      .where(and(...conds))
      .orderBy(s.appointment.startAt, s.appointment.id)
      .limit(f.limit);
  }
  // Unfiltered listing: keyset over (createdAt, id).
  const cursor = f.cursor
    ? or(
        sql`${s.appointment.createdAt} < ${f.cursor.beforeCreatedAt}`,
        and(
          eq(s.appointment.createdAt, f.cursor.beforeCreatedAt),
          sql`${s.appointment.id} < ${f.cursor.beforeId}`,
        ),
      )
    : undefined;
  return db
    .select(apptColumns)
    .from(s.appointment)
    .where(and(apptNotDeleted, cursor))
    .orderBy(desc(s.appointment.createdAt), desc(s.appointment.id))
    .limit(f.limit);
}

export interface UpdateAppointmentChanges {
  startAt?: Date;
  endAt?: Date;
  departmentId?: string | null;
  appointmentType?: "routine" | "walk_in" | "follow_up";
  specialties?: SpecialtyCoding[];
  reasonText?: string | null;
  priority?: number;
}

/** Reschedule/edit under optimistic concurrency (DDR-0009). Overlap ⇒ 23P01. */
export async function updateAppointmentVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  changes: UpdateAppointmentChanges,
): Promise<AppointmentRow | undefined> {
  const set: Record<string, unknown> = {
    version: sql`${s.appointment.version} + 1`,
    updatedAt: sql`now()`,
  };
  if (changes.startAt !== undefined) set.startAt = changes.startAt;
  if (changes.endAt !== undefined) set.endAt = changes.endAt;
  if (changes.departmentId !== undefined) set.departmentId = changes.departmentId;
  if (changes.appointmentType !== undefined) set.appointmentType = changes.appointmentType;
  if (changes.reasonText !== undefined) set.reasonText = changes.reasonText;
  if (changes.priority !== undefined) set.priority = changes.priority;
  if (changes.specialties !== undefined) {
    const primary = changes.specialties[0];
    set.specialtyCodings = changes.specialties;
    set.specialtySystem = primary?.system ?? null;
    set.specialtyCode = primary?.code ?? null;
    set.specialtyDisplay = primary?.display ?? null;
  }
  const [row] = await db
    .update(s.appointment)
    .set(set)
    .where(
      and(eq(s.appointment.id, id), eq(s.appointment.version, expectedVersion), apptNotDeleted),
    )
    .returning(apptColumns);
  return row;
}

export interface AppointmentTransition {
  status: "checked_in" | "in_progress" | "cancelled" | "no_show";
  cancelReason?: string | null;
  queueToken?: number;
  checkedIn?: boolean;
}

/**
 * Status transition under optimistic concurrency (cancel / no-show / check-in).
 * Constrained to a required current status so races/replays are rejected.
 */
export async function transitionAppointmentVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  fromStatus: AppointmentRow["status"],
  t: AppointmentTransition,
): Promise<AppointmentRow | undefined> {
  const set: Record<string, unknown> = {
    status: t.status,
    version: sql`${s.appointment.version} + 1`,
    updatedAt: sql`now()`,
  };
  if (t.cancelReason !== undefined) set.cancelReason = t.cancelReason;
  if (t.queueToken !== undefined) set.queueToken = t.queueToken;
  if (t.checkedIn) set.checkedInAt = sql`now()`;
  const [row] = await db
    .update(s.appointment)
    .set(set)
    .where(
      and(
        eq(s.appointment.id, id),
        eq(s.appointment.version, expectedVersion),
        eq(s.appointment.status, fromStatus),
        apptNotDeleted,
      ),
    )
    .returning(apptColumns);
  return row;
}

/* ------------------------------- encounter ------------------------------- */

export interface EncounterRow {
  id: string;
  tenantId: string;
  appointmentId: string | null;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  departmentId: string | null;
  class: "AMB";
  status: "in_progress" | "finished" | "cancelled";
  periodStart: Date;
  periodEnd: Date | null;
  version: number;
  createdAt: Date;
}

const encColumns = {
  id: s.encounter.id,
  tenantId: s.encounter.tenantId,
  appointmentId: s.encounter.appointmentId,
  patientId: s.encounter.patientId,
  practitionerId: s.encounter.practitionerId,
  facilityId: s.encounter.facilityId,
  departmentId: s.encounter.departmentId,
  class: s.encounter.class,
  status: s.encounter.status,
  periodStart: s.encounter.periodStart,
  periodEnd: s.encounter.periodEnd,
  version: s.encounter.version,
  createdAt: s.encounter.createdAt,
} as const;

export interface InsertEncounterInput {
  id: string;
  tenantId: string;
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  facilityId: string;
  departmentId?: string | null;
}

export async function insertEncounter(
  db: TenantDb,
  input: InsertEncounterInput,
): Promise<EncounterRow> {
  const [row] = await db
    .insert(s.encounter)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      departmentId: input.departmentId ?? null,
    })
    .returning(encColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getEncounterById(
  db: TenantDb,
  id: string,
): Promise<EncounterRow | undefined> {
  const [row] = await db
    .select(encColumns)
    .from(s.encounter)
    .where(and(eq(s.encounter.id, id), isNull(s.encounter.deletedAt)))
    .limit(1);
  return row;
}

export async function getEncounterByAppointmentId(
  db: TenantDb,
  appointmentId: string,
): Promise<EncounterRow | undefined> {
  const [row] = await db
    .select(encColumns)
    .from(s.encounter)
    .where(and(eq(s.encounter.appointmentId, appointmentId), isNull(s.encounter.deletedAt)))
    .limit(1);
  return row;
}

/* ------------------------------ queue token ------------------------------ */

/** Gap-free per (facility, department, day) token issuance (mirrors issueMrn). */
export async function issueQueueToken(
  db: TenantDb,
  input: {
    tenantId: string;
    facilityId: string;
    departmentId?: string | null;
    serviceDate: string;
  },
): Promise<number> {
  const departmentId = input.departmentId ?? NIL_UUID;
  const [row] = await db
    .insert(s.opdQueueCounter)
    .values({
      tenantId: input.tenantId,
      facilityId: input.facilityId,
      departmentId,
      serviceDate: input.serviceDate,
      lastValue: 1,
    })
    .onConflictDoUpdate({
      target: [
        s.opdQueueCounter.tenantId,
        s.opdQueueCounter.facilityId,
        s.opdQueueCounter.departmentId,
        s.opdQueueCounter.serviceDate,
      ],
      set: { lastValue: sql`${s.opdQueueCounter.lastValue} + 1` },
    })
    .returning({ lastValue: s.opdQueueCounter.lastValue });
  if (!row) throw new Error("queue counter upsert returned no row");
  return row.lastValue;
}

/* ----------------------------- availability ------------------------------ */

export interface AvailabilityRow {
  id: string;
  tenantId: string;
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

const availColumns = {
  id: s.practitionerAvailability.id,
  tenantId: s.practitionerAvailability.tenantId,
  practitionerId: s.practitionerAvailability.practitionerId,
  facilityId: s.practitionerAvailability.facilityId,
  dayOfWeek: s.practitionerAvailability.dayOfWeek,
  startTime: s.practitionerAvailability.startTime,
  endTime: s.practitionerAvailability.endTime,
  slotMinutes: s.practitionerAvailability.slotMinutes,
  validFrom: s.practitionerAvailability.validFrom,
  validUntil: s.practitionerAvailability.validUntil,
  version: s.practitionerAvailability.version,
  createdAt: s.practitionerAvailability.createdAt,
} as const;

export interface InsertAvailabilityInput {
  id: string;
  tenantId: string;
  practitionerId: string;
  facilityId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  validFrom?: string | null;
  validUntil?: string | null;
}

export async function insertAvailability(
  db: TenantDb,
  input: InsertAvailabilityInput,
): Promise<AvailabilityRow> {
  const [row] = await db
    .insert(s.practitionerAvailability)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      slotMinutes: input.slotMinutes,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    })
    .returning(availColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listAvailabilityByPractitioner(
  db: TenantDb,
  practitionerId: string,
): Promise<AvailabilityRow[]> {
  return db
    .select(availColumns)
    .from(s.practitionerAvailability)
    .where(
      and(
        eq(s.practitionerAvailability.practitionerId, practitionerId),
        isNull(s.practitionerAvailability.deletedAt),
      ),
    )
    .orderBy(s.practitionerAvailability.dayOfWeek, s.practitionerAvailability.startTime);
}

/**
 * Compute FREE slots for a practitioner on a date (decision D-4.2): expand each
 * matching weekly template into slot-sized intervals (interpreting local times
 * in the facility timezone) and drop any that overlap an active appointment.
 * The DB exclusion constraint remains the authority; this is advisory UX.
 */
export async function computeFreeSlots(
  db: TenantDb,
  practitionerId: string,
  date: string,
): Promise<{ startAt: Date; endAt: Date }[]> {
  const rows = await db.execute<{ start_at: string | Date; end_at: string | Date }>(sql`
    WITH template AS (
      SELECT a.start_time, a.end_time, a.slot_minutes, f.timezone AS zone
      FROM clinical.practitioner_availability a
      JOIN platform.facility f
        ON f.tenant_id = a.tenant_id AND f.id = a.facility_id
      WHERE a.practitioner_id = ${practitionerId}
        AND a.deleted_at IS NULL
        AND a.day_of_week = EXTRACT(dow FROM ${date}::date)
        AND (a.valid_from  IS NULL OR a.valid_from  <= ${date}::date)
        AND (a.valid_until IS NULL OR a.valid_until >= ${date}::date)
    ),
    slots AS (
      SELECT
        ((${date}::date + t.start_time) AT TIME ZONE t.zone)
          + (n * t.slot_minutes * interval '1 minute') AS start_at,
        ((${date}::date + t.start_time) AT TIME ZONE t.zone)
          + ((n + 1) * t.slot_minutes * interval '1 minute') AS end_at
      FROM template t
      CROSS JOIN LATERAL generate_series(
        0,
        (EXTRACT(epoch FROM (t.end_time - t.start_time)) / 60 / t.slot_minutes)::int - 1
      ) AS n
    )
    SELECT start_at, end_at
    FROM slots sl
    WHERE NOT EXISTS (
      SELECT 1 FROM clinical.appointment ap
      WHERE ap.practitioner_id = ${practitionerId}
        AND ap.status IN ('booked','checked_in','in_progress')
        AND ap.slot && tstzrange(sl.start_at, sl.end_at, '[)')
    )
    ORDER BY start_at
  `);
  // Raw SQL results come back as strings; normalise to Date at the boundary.
  return rows.rows.map((r) => ({ startAt: new Date(r.start_at), endAt: new Date(r.end_at) }));
}

/* --------------------------------- queue --------------------------------- */

export interface QueueEntryRow {
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

/**
 * The OPD queue (decision D-4.3): active appointments for a facility/day,
 * ordered by priority then token. Joins patient/practitioner names for display
 * (read is audited by the service, like patient search).
 */
export async function queueEntries(
  db: TenantDb,
  input: { facilityId: string; departmentId?: string | null; dayStart: Date; dayEnd: Date },
): Promise<QueueEntryRow[]> {
  const rows = await db
    .select({
      appointmentId: s.appointment.id,
      patientId: s.appointment.patientId,
      patientName: sql<string>`${s.patient.nameGiven} || ' ' || ${s.patient.nameFamily}`,
      practitionerId: s.appointment.practitionerId,
      practitionerName: sql<string>`${s.practitioner.nameGiven} || ' ' || ${s.practitioner.nameFamily}`,
      queueToken: s.appointment.queueToken,
      priority: s.appointment.priority,
      status: s.appointment.status,
      startAt: s.appointment.startAt,
      checkedInAt: s.appointment.checkedInAt,
    })
    .from(s.appointment)
    .leftJoin(
      s.patient,
      and(
        eq(s.patient.tenantId, s.appointment.tenantId),
        eq(s.patient.id, s.appointment.patientId),
      ),
    )
    .leftJoin(
      s.practitioner,
      and(
        eq(s.practitioner.tenantId, s.appointment.tenantId),
        eq(s.practitioner.id, s.appointment.practitionerId),
      ),
    )
    .where(
      and(
        eq(s.appointment.facilityId, input.facilityId),
        input.departmentId ? eq(s.appointment.departmentId, input.departmentId) : undefined,
        gte(s.appointment.startAt, input.dayStart),
        lte(s.appointment.startAt, input.dayEnd),
        or(eq(s.appointment.status, "checked_in"), eq(s.appointment.status, "in_progress")),
        apptNotDeleted,
      ),
    )
    .orderBy(desc(s.appointment.priority), s.appointment.queueToken);
  return rows as QueueEntryRow[];
}
