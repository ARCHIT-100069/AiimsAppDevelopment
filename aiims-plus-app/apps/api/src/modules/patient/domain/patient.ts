/**
 * Patient aggregate — the first clinical entity (Master Plan §12).
 * Pure and framework-free (BDR-0001); owns the demographic invariants.
 * The domain sees PLAINTEXT identifiers only: encryption is an
 * infrastructure concern (DDR-0006), never a domain one.
 */

export type Gender = "male" | "female" | "other" | "unknown";

export interface PatientProps {
  readonly id: string;
  readonly tenantId: string;
  readonly mrn: string;
  readonly nameGiven: string;
  readonly nameFamily: string;
  readonly gender: Gender;
  /** ISO date (YYYY-MM-DD). */
  readonly birthDate: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly abhaNumber: string | null;
  readonly abhaAddress: string | null;
  readonly address: Record<string, unknown> | null;
  readonly version: number;
  readonly createdAt: Date;
}

export class InvalidPatientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPatientError";
  }
}

export interface DemographicChanges {
  nameGiven?: string;
  nameFamily?: string;
  gender?: Gender;
  birthDate?: string;
  phone?: string | null;
  email?: string | null;
  address?: Record<string, unknown> | null;
}

const EARLIEST_BIRTH = "1900-01-01";

function assertBirthDate(birthDate: string): void {
  const today = new Date().toISOString().slice(0, 10);
  if (birthDate > today) throw new InvalidPatientError("Birth date cannot be in the future");
  if (birthDate < EARLIEST_BIRTH) throw new InvalidPatientError("Birth date is implausibly old");
}

function assertName(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidPatientError(`${label} must not be empty`);
  return trimmed;
}

export class Patient {
  private constructor(readonly props: PatientProps) {}

  static register(input: {
    id: string;
    tenantId: string;
    mrn: string;
    nameGiven: string;
    nameFamily: string;
    gender: Gender;
    birthDate: string;
    phone?: string | null;
    email?: string | null;
    abhaNumber?: string | null;
    abhaAddress?: string | null;
    address?: Record<string, unknown> | null;
  }): Patient {
    assertBirthDate(input.birthDate);
    return new Patient({
      id: input.id,
      tenantId: input.tenantId,
      mrn: input.mrn,
      nameGiven: assertName(input.nameGiven, "Given name"),
      nameFamily: assertName(input.nameFamily, "Family name"),
      gender: input.gender,
      birthDate: input.birthDate,
      phone: input.phone ?? null,
      email: input.email ?? null,
      abhaNumber: input.abhaNumber ?? null,
      abhaAddress: input.abhaAddress ?? null,
      address: input.address ?? null,
      version: 0,
      createdAt: new Date(),
    });
  }

  /** Validated demographic update; identifier/MRN/ABHA changes are separate flows. */
  withChanges(changes: DemographicChanges): Patient {
    const next: PatientProps = {
      ...this.props,
      ...(changes.nameGiven !== undefined
        ? { nameGiven: assertName(changes.nameGiven, "Given name") }
        : {}),
      ...(changes.nameFamily !== undefined
        ? { nameFamily: assertName(changes.nameFamily, "Family name") }
        : {}),
      ...(changes.gender !== undefined ? { gender: changes.gender } : {}),
      ...(changes.birthDate !== undefined ? { birthDate: changes.birthDate } : {}),
      ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
      ...(changes.email !== undefined ? { email: changes.email } : {}),
      ...(changes.address !== undefined ? { address: changes.address } : {}),
    };
    if (changes.birthDate !== undefined) assertBirthDate(changes.birthDate);
    return new Patient(next);
  }

  static fromPersistence(props: PatientProps): Patient {
    return new Patient(props);
  }
}
