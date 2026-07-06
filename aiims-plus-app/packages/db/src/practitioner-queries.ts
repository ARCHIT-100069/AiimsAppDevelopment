/**
 * Stage 3 data-access helpers (Practitioner). Drizzle stays confined here;
 * the repository maps domain ↔ these rows. Every helper requires a
 * tenant-scoped transaction (DDR-0002).
 */
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Keyset } from "./platform-queries";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface SpecialtyCoding {
  system: string;
  code: string;
  display: string;
}

export interface PractitionerRow {
  id: string;
  tenantId: string;
  appUserId: string;
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  departmentId: string | null;
  specialtyCodings: unknown;
  status: "active" | "inactive";
  version: number;
  createdAt: Date;
}

const columns = {
  id: s.practitioner.id,
  tenantId: s.practitioner.tenantId,
  appUserId: s.practitioner.appUserId,
  nameGiven: s.practitioner.nameGiven,
  nameFamily: s.practitioner.nameFamily,
  registrationNo: s.practitioner.registrationNo,
  departmentId: s.practitioner.departmentId,
  specialtyCodings: s.practitioner.specialtyCodings,
  status: s.practitioner.status,
  version: s.practitioner.version,
  createdAt: s.practitioner.createdAt,
} as const;

const notDeleted = isNull(s.practitioner.deletedAt);

export interface InsertPractitionerInput {
  id: string;
  tenantId: string;
  appUserId: string;
  nameGiven: string;
  nameFamily: string;
  registrationNo: string;
  departmentId?: string | null;
  specialties: SpecialtyCoding[];
}

export async function insertPractitioner(
  db: TenantDb,
  input: InsertPractitionerInput,
): Promise<PractitionerRow> {
  const primary = input.specialties[0];
  const [row] = await db
    .insert(s.practitioner)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      appUserId: input.appUserId,
      nameGiven: input.nameGiven,
      nameFamily: input.nameFamily,
      registrationNo: input.registrationNo,
      departmentId: input.departmentId ?? null,
      specialtySystem: primary?.system ?? null,
      specialtyCode: primary?.code ?? null,
      specialtyDisplay: primary?.display ?? null,
      specialtyCodings: input.specialties,
    })
    .returning(columns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getPractitionerById(
  db: TenantDb,
  id: string,
): Promise<PractitionerRow | undefined> {
  const [row] = await db
    .select(columns)
    .from(s.practitioner)
    .where(and(eq(s.practitioner.id, id), notDeleted))
    .limit(1);
  return row;
}

export async function searchPractitionersByText(
  db: TenantDb,
  q: string,
  limit: number,
): Promise<PractitionerRow[]> {
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  return db
    .select(columns)
    .from(s.practitioner)
    .where(
      and(
        notDeleted,
        ilike(sql`${s.practitioner.nameGiven} || ' ' || ${s.practitioner.nameFamily}`, like),
      ),
    )
    .orderBy(desc(s.practitioner.createdAt), desc(s.practitioner.id))
    .limit(limit);
}

export async function findPractitionerByRegistration(
  db: TenantDb,
  registrationNo: string,
): Promise<PractitionerRow | undefined> {
  const [row] = await db
    .select(columns)
    .from(s.practitioner)
    .where(and(eq(s.practitioner.registrationNo, registrationNo), notDeleted))
    .limit(1);
  return row;
}

export async function listPractitionersByDepartment(
  db: TenantDb,
  departmentId: string,
  limit: number,
): Promise<PractitionerRow[]> {
  return db
    .select(columns)
    .from(s.practitioner)
    .where(and(eq(s.practitioner.departmentId, departmentId), notDeleted))
    .orderBy(desc(s.practitioner.createdAt), desc(s.practitioner.id))
    .limit(limit);
}

export async function listPractitioners(
  db: TenantDb,
  limit: number,
  k?: Keyset,
): Promise<PractitionerRow[]> {
  const cursor = k
    ? or(
        sql`${s.practitioner.createdAt} < ${k.beforeCreatedAt}`,
        and(
          eq(s.practitioner.createdAt, k.beforeCreatedAt),
          sql`${s.practitioner.id} < ${k.beforeId}`,
        ),
      )
    : undefined;
  return db
    .select(columns)
    .from(s.practitioner)
    .where(and(notDeleted, cursor))
    .orderBy(desc(s.practitioner.createdAt), desc(s.practitioner.id))
    .limit(limit);
}

export interface UpdatePractitionerChanges {
  nameGiven?: string;
  nameFamily?: string;
  departmentId?: string | null;
  status?: "active" | "inactive";
  specialties?: SpecialtyCoding[];
}

/**
 * Optimistic concurrency (DDR-0009): 0 rows ⇒ stale version ⇒ 409 upstream.
 * app_user_id is deliberately NOT settable here — the link is immutable.
 */
export async function updatePractitionerVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  changes: UpdatePractitionerChanges,
): Promise<PractitionerRow | undefined> {
  const set: Record<string, unknown> = {
    version: sql`${s.practitioner.version} + 1`,
    updatedAt: sql`now()`,
  };
  if (changes.nameGiven !== undefined) set.nameGiven = changes.nameGiven;
  if (changes.nameFamily !== undefined) set.nameFamily = changes.nameFamily;
  if (changes.departmentId !== undefined) set.departmentId = changes.departmentId;
  if (changes.status !== undefined) set.status = changes.status;
  if (changes.specialties !== undefined) {
    const primary = changes.specialties[0];
    set.specialtyCodings = changes.specialties;
    set.specialtySystem = primary?.system ?? null;
    set.specialtyCode = primary?.code ?? null;
    set.specialtyDisplay = primary?.display ?? null;
  }
  const [row] = await db
    .update(s.practitioner)
    .set(set)
    .where(and(eq(s.practitioner.id, id), eq(s.practitioner.version, expectedVersion), notDeleted))
    .returning(columns);
  return row;
}

/** Linked user's display name — used to default the practitioner name (decision c). */
export async function getAppUserDisplayName(
  db: TenantDb,
  appUserId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ displayName: s.appUser.displayName })
    .from(s.appUser)
    .where(eq(s.appUser.id, appUserId))
    .limit(1);
  return row?.displayName;
}

/** Role codes of the app_user a practitioner would link to (decision i check). */
export async function roleCodesForAppUser(db: TenantDb, appUserId: string): Promise<string[]> {
  const rows = await db
    .select({ code: s.role.code })
    .from(s.userRole)
    .innerJoin(s.role, eq(s.userRole.roleId, s.role.id))
    .where(eq(s.userRole.userId, appUserId));
  return rows.map((r) => r.code);
}
