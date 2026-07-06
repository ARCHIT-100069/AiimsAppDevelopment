/**
 * Practitioner aggregate (Master Plan §13) — the clinical profile over an
 * app_user. Pure, framework-free (BDR-0001). The link to the login
 * (appUserId) is set once at registration and is IMMUTABLE thereafter
 * (founder requirement): there is no method that changes it.
 */

export interface SpecialtyCoding {
  system: string;
  code: string;
  display: string;
}

export interface PractitionerProps {
  readonly id: string;
  readonly tenantId: string;
  readonly appUserId: string;
  readonly nameGiven: string;
  readonly nameFamily: string;
  readonly registrationNo: string;
  readonly departmentId: string | null;
  readonly specialties: SpecialtyCoding[];
  readonly status: "active" | "inactive";
  readonly version: number;
  readonly createdAt: Date;
}

export class InvalidPractitionerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPractitionerError";
  }
}

export interface PractitionerChanges {
  nameGiven?: string;
  nameFamily?: string;
  departmentId?: string | null;
  status?: "active" | "inactive";
  specialties?: SpecialtyCoding[];
}

function assertName(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidPractitionerError(`${label} must not be empty`);
  return trimmed;
}

export class Practitioner {
  private constructor(readonly props: PractitionerProps) {}

  static register(input: {
    id: string;
    tenantId: string;
    appUserId: string;
    nameGiven: string;
    nameFamily: string;
    registrationNo: string;
    departmentId?: string | null;
    specialties?: SpecialtyCoding[];
  }): Practitioner {
    const reg = input.registrationNo.trim();
    if (!reg) throw new InvalidPractitionerError("Registration number is required");
    return new Practitioner({
      id: input.id,
      tenantId: input.tenantId,
      appUserId: input.appUserId,
      nameGiven: assertName(input.nameGiven, "Given name"),
      nameFamily: assertName(input.nameFamily, "Family name"),
      registrationNo: reg,
      departmentId: input.departmentId ?? null,
      specialties: input.specialties ?? [],
      status: "active",
      version: 0,
      createdAt: new Date(),
    });
  }

  /** Mutable fields only — NOT appUserId or registrationNo (immutable link/credential). */
  withChanges(changes: PractitionerChanges): Practitioner {
    return new Practitioner({
      ...this.props,
      ...(changes.nameGiven !== undefined
        ? { nameGiven: assertName(changes.nameGiven, "Given name") }
        : {}),
      ...(changes.nameFamily !== undefined
        ? { nameFamily: assertName(changes.nameFamily, "Family name") }
        : {}),
      ...(changes.departmentId !== undefined ? { departmentId: changes.departmentId } : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.specialties !== undefined ? { specialties: changes.specialties } : {}),
    });
  }

  static fromPersistence(props: PractitionerProps): Practitioner {
    return new Practitioner(props);
  }
}
