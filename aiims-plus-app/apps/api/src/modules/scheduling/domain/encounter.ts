/**
 * Encounter aggregate (Stage 4 skeleton, decision D-4.1) — pure (BDR-0001).
 * Check-in OPENS an encounter; Stage 5 (EMR) extends this with documentation
 * and the sign/finalize lifecycle. Kept intentionally minimal: it is the
 * clinical ANCHOR future children (notes/observations/orders/invoices) attach to.
 */

export type EncounterStatus = "in_progress" | "finished" | "cancelled";

export interface EncounterProps {
  readonly id: string;
  readonly tenantId: string;
  readonly appointmentId: string | null;
  readonly patientId: string;
  readonly practitionerId: string;
  readonly facilityId: string;
  readonly departmentId: string | null;
  readonly class: "AMB";
  readonly status: EncounterStatus;
  readonly chiefComplaint: string | null;
  readonly signedAt: Date | null;
  readonly signedBy: string | null;
  readonly periodStart: Date;
  readonly periodEnd: Date | null;
  readonly version: number;
  readonly createdAt: Date;
}

export class Encounter {
  private constructor(readonly props: EncounterProps) {}

  /** Open an ambulatory OPD encounter from a checked-in appointment. */
  static open(input: {
    id: string;
    tenantId: string;
    appointmentId: string;
    patientId: string;
    practitionerId: string;
    facilityId: string;
    departmentId?: string | null;
  }): Encounter {
    const now = new Date();
    return new Encounter({
      id: input.id,
      tenantId: input.tenantId,
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      facilityId: input.facilityId,
      departmentId: input.departmentId ?? null,
      class: "AMB",
      status: "in_progress",
      chiefComplaint: null,
      signedAt: null,
      signedBy: null,
      periodStart: now,
      periodEnd: null,
      version: 0,
      createdAt: now,
    });
  }

  static fromPersistence(props: EncounterProps): Encounter {
    return new Encounter(props);
  }
}
