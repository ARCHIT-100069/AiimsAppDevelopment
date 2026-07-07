/**
 * Stage 1 data-access helpers (Core Platform). Same contract as queries.ts:
 * Drizzle stays inside this package; every tenant-scoped helper requires a
 * TenantDb from withTenantContext (DDR-0002).
 *
 * Duplicate-safety (founder clarification #3) is DB-anchored: natural-key
 * UNIQUE constraints + ON CONFLICT idempotency where replays are legal, and
 * typed violation detection where they are client errors (409).
 */
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Pool } from "pg";
import { newId } from "./ids";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

/* ------------------------------ error helpers --------------------------- */

function pgCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.cause?.code ?? e.code;
}

/** Postgres 23505 — natural-key duplicate ⇒ map to 409 CONFLICT upstream. */
export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

/** Postgres 23503 — referenced parent missing (or cross-tenant) ⇒ 404/422 upstream. */
export function isForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === "23503";
}

/** Postgres 23P01 — exclusion violation (slot overlap / double-booking) ⇒ 409 upstream. */
export function isExclusionViolation(err: unknown): boolean {
  return pgCode(err) === "23P01";
}

/* ------------------------------ keyset paging ---------------------------- */

export interface Keyset {
  beforeCreatedAt: Date;
  beforeId: string;
}

const afterCursor = (table: { createdAt: unknown; id: unknown }, k?: Keyset) =>
  k
    ? or(
        lt(table.createdAt as never, k.beforeCreatedAt),
        and(eq(table.createdAt as never, k.beforeCreatedAt), lt(table.id as never, k.beforeId)),
      )
    : undefined;

/* --------------------------------- tenancy ------------------------------ */

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  createdAt: Date;
}

/**
 * Idempotent tenant creation: replaying the same id+slug returns the existing
 * row (`created: false`); a slug held by a DIFFERENT tenant id is a conflict
 * the caller maps to 409.
 */
export async function insertTenantIdempotent(
  db: TenantDb,
  row: { id: string; slug: string; name: string },
): Promise<{ tenant: TenantRow; created: boolean }> {
  const inserted = await db
    .insert(s.tenant)
    .values(row)
    .onConflictDoNothing({ target: s.tenant.slug })
    .returning();
  if (inserted[0]) return { tenant: inserted[0], created: true };
  const [existing] = await db.select().from(s.tenant).where(eq(s.tenant.slug, row.slug)).limit(1);
  if (!existing) throw new Error("tenant upsert race: row vanished");
  return { tenant: existing, created: false };
}

export async function listTenants(pool: Pool, limit: number): Promise<TenantRow[]> {
  const { rows } = await pool.query<TenantRow & { createdat: Date }>(
    `SELECT id, slug, name, status, created_at AS "createdAt"
       FROM platform.tenant ORDER BY created_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

/** Seed the standard role set for a new tenant (idempotent). */
export async function ensureTenantRoles(
  db: TenantDb,
  tenantId: string,
  codes: readonly string[],
): Promise<Map<string, string>> {
  for (const code of codes) {
    await db
      .insert(s.role)
      .values({ id: newId(), tenantId, code, name: code.replace(/_/g, " ") })
      .onConflictDoNothing();
  }
  const rows = await db.select({ id: s.role.id, code: s.role.code }).from(s.role);
  return new Map(rows.map((r) => [r.code, r.id]));
}

/* --------------------------------- identity ----------------------------- */

export interface AppUserRow {
  id: string;
  displayName: string;
  status: "active" | "disabled";
  createdAt: Date;
}

export async function insertAppUser(
  db: TenantDb,
  row: { id: string; tenantId: string; keycloakSub: string; displayName: string },
): Promise<AppUserRow> {
  const [inserted] = await db.insert(s.appUser).values(row).returning();
  if (!inserted) throw new Error("insert returned no row");
  return inserted;
}

/** Idempotent role assignment: replay is a no-op (clarification #3). */
export async function assignRoleIdempotent(
  db: TenantDb,
  row: { tenantId: string; userId: string; roleId: string; departmentId?: string },
): Promise<void> {
  await db.insert(s.userRole).values(row).onConflictDoNothing();
}

export async function findRoleByCode(
  db: TenantDb,
  code: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: s.role.id })
    .from(s.role)
    .where(eq(s.role.code, code))
    .limit(1);
  return row;
}

export async function listUsers(db: TenantDb, limit: number, k?: Keyset): Promise<AppUserRow[]> {
  return db
    .select({
      id: s.appUser.id,
      displayName: s.appUser.displayName,
      status: s.appUser.status,
      createdAt: s.appUser.createdAt,
    })
    .from(s.appUser)
    .where(afterCursor(s.appUser, k))
    .orderBy(desc(s.appUser.createdAt), desc(s.appUser.id))
    .limit(limit);
}

export async function roleCodesForUsers(
  db: TenantDb,
  userIds: string[],
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: s.userRole.userId, code: s.role.code })
    .from(s.userRole)
    .innerJoin(s.role, eq(s.userRole.roleId, s.role.id))
    .where(inArray(s.userRole.userId, userIds));
  const map = new Map<string, string[]>();
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), r.code]);
  return map;
}

/* ------------------------------ org structure --------------------------- */

export interface OrganizationRow {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "chain";
  createdAt: Date;
}

export async function insertOrganization(
  db: TenantDb,
  row: { id: string; tenantId: string; name: string; type: "hospital" | "clinic" | "chain" },
): Promise<OrganizationRow> {
  const [inserted] = await db.insert(s.organization).values(row).returning();
  if (!inserted) throw new Error("insert returned no row");
  return inserted;
}

export async function listOrganizations(
  db: TenantDb,
  limit: number,
  k?: Keyset,
): Promise<OrganizationRow[]> {
  return db
    .select({
      id: s.organization.id,
      name: s.organization.name,
      type: s.organization.type,
      createdAt: s.organization.createdAt,
    })
    .from(s.organization)
    .where(and(isNull(s.organization.deletedAt), afterCursor(s.organization, k)))
    .orderBy(desc(s.organization.createdAt), desc(s.organization.id))
    .limit(limit);
}

export interface FacilityRow {
  id: string;
  organizationId: string;
  name: string;
  timezone: string;
  createdAt: Date;
}

export async function insertFacility(
  db: TenantDb,
  row: {
    id: string;
    tenantId: string;
    organizationId: string;
    name: string;
    timezone: string;
    address?: Record<string, unknown>;
  },
): Promise<FacilityRow> {
  const [inserted] = await db.insert(s.facility).values(row).returning();
  if (!inserted) throw new Error("insert returned no row");
  return inserted;
}

export async function listFacilities(
  db: TenantDb,
  limit: number,
  k?: Keyset,
): Promise<FacilityRow[]> {
  return db
    .select({
      id: s.facility.id,
      organizationId: s.facility.organizationId,
      name: s.facility.name,
      timezone: s.facility.timezone,
      createdAt: s.facility.createdAt,
    })
    .from(s.facility)
    .where(and(isNull(s.facility.deletedAt), afterCursor(s.facility, k)))
    .orderBy(desc(s.facility.createdAt), desc(s.facility.id))
    .limit(limit);
}

export interface DepartmentRow {
  id: string;
  facilityId: string;
  name: string;
  code: string;
  createdAt: Date;
}

export async function insertDepartment(
  db: TenantDb,
  row: { id: string; tenantId: string; facilityId: string; name: string; code: string },
): Promise<DepartmentRow> {
  const [inserted] = await db.insert(s.department).values(row).returning();
  if (!inserted) throw new Error("insert returned no row");
  return inserted;
}

export async function listDepartments(
  db: TenantDb,
  limit: number,
  k?: Keyset,
): Promise<DepartmentRow[]> {
  return db
    .select({
      id: s.department.id,
      facilityId: s.department.facilityId,
      name: s.department.name,
      code: s.department.code,
      createdAt: s.department.createdAt,
    })
    .from(s.department)
    .where(and(isNull(s.department.deletedAt), afterCursor(s.department, k)))
    .orderBy(desc(s.department.createdAt), desc(s.department.id))
    .limit(limit);
}

/* -------------------------------- reference ----------------------------- */

export interface CodeSystemRow {
  code: string;
  name: string;
  uri: string;
  release: string;
}

/** Global, non-tenant, read-only — served off the raw pool (no RLS on reference.*). */
export async function listCodeSystems(pool: Pool): Promise<CodeSystemRow[]> {
  const { rows } = await pool.query<CodeSystemRow>(
    "SELECT code, name, uri, release FROM reference.code_system ORDER BY code",
  );
  return rows;
}

export interface ReferenceCodeRow {
  system: string;
  code: string;
  display: string;
  active: boolean;
}

export async function listReferenceCodes(
  pool: Pool,
  input: { system: string; limit: number; afterCode?: string },
): Promise<ReferenceCodeRow[]> {
  const { rows } = await pool.query<ReferenceCodeRow>(
    `SELECT system, code, display, active FROM reference.code
      WHERE system = $1 AND ($3::text IS NULL OR code > $3)
      ORDER BY code ASC LIMIT $2`,
    [input.system, input.limit, input.afterCode ?? null],
  );
  return rows;
}
