/**
 * Repository implementation: maps domain ↔ rows via @aiims/db helpers
 * (Drizzle stays confined). Always inside a tenant-context transaction.
 * app_user_id is never included in the update path (immutable link).
 */
import { Injectable } from "@nestjs/common";
import {
  findPractitionerByRegistration,
  getAppUserDisplayName,
  getPractitionerById,
  insertPractitioner,
  listPractitioners,
  listPractitionersByDepartment,
  roleCodesForAppUser,
  searchPractitionersByText,
  updatePractitionerVersioned,
  type PractitionerRow,
  type TenantDb,
} from "@aiims/db";
import {
  Practitioner,
  type PractitionerChanges,
  type SpecialtyCoding,
} from "../domain/practitioner";
import type {
  DataContext,
  PractitionerRepository,
  PractitionerSearch,
} from "../ports/practitioner-repository.port";

@Injectable()
export class DrizzlePractitionerRepository implements PractitionerRepository {
  async insert(ctx: DataContext, practitioner: Practitioner): Promise<void> {
    const p = practitioner.props;
    await insertPractitioner(ctx as TenantDb, {
      id: p.id,
      tenantId: p.tenantId,
      appUserId: p.appUserId,
      nameGiven: p.nameGiven,
      nameFamily: p.nameFamily,
      registrationNo: p.registrationNo,
      departmentId: p.departmentId,
      specialties: p.specialties,
    });
  }

  async findById(ctx: DataContext, id: string): Promise<Practitioner | undefined> {
    const row = await getPractitionerById(ctx as TenantDb, id);
    return row ? this.toDomain(ctx, row) : undefined;
  }

  async search(ctx: DataContext, query: PractitionerSearch): Promise<Practitioner[]> {
    const db = ctx as TenantDb;
    let rows: PractitionerRow[];
    if (query.registrationNo) {
      const row = await findPractitionerByRegistration(db, query.registrationNo);
      rows = row ? [row] : [];
    } else if (query.departmentId) {
      rows = await listPractitionersByDepartment(db, query.departmentId, query.limit);
    } else if (query.q) {
      rows = await searchPractitionersByText(db, query.q, query.limit);
    } else {
      rows = await listPractitioners(db, query.limit, query.cursor);
    }
    return rows.map((r) => this.rowToDomain(ctx, r));
  }

  async update(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: PractitionerChanges,
  ): Promise<Practitioner | "conflict" | "missing"> {
    const db = ctx as TenantDb;
    const existing = await getPractitionerById(db, id);
    if (!existing) return "missing";
    const updated = await updatePractitionerVersioned(db, id, expectedVersion, {
      ...(changes.nameGiven !== undefined ? { nameGiven: changes.nameGiven } : {}),
      ...(changes.nameFamily !== undefined ? { nameFamily: changes.nameFamily } : {}),
      ...(changes.departmentId !== undefined ? { departmentId: changes.departmentId } : {}),
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.specialties !== undefined ? { specialties: changes.specialties } : {}),
    });
    return updated ? this.rowToDomain(ctx, updated) : "conflict";
  }

  async appUserRoleCodes(ctx: DataContext, appUserId: string): Promise<string[]> {
    return roleCodesForAppUser(ctx as TenantDb, appUserId);
  }

  async appUserDisplayName(ctx: DataContext, appUserId: string): Promise<string | undefined> {
    return getAppUserDisplayName(ctx as TenantDb, appUserId);
  }

  private toDomain(ctx: DataContext, row: PractitionerRow): Practitioner {
    return this.rowToDomain(ctx, row);
  }

  private rowToDomain(ctx: DataContext, row: PractitionerRow): Practitioner {
    void ctx;
    return Practitioner.fromPersistence({
      id: row.id,
      tenantId: row.tenantId,
      appUserId: row.appUserId,
      nameGiven: row.nameGiven,
      nameFamily: row.nameFamily,
      registrationNo: row.registrationNo,
      departmentId: row.departmentId,
      specialties: (row.specialtyCodings as SpecialtyCoding[]) ?? [],
      status: row.status,
      version: row.version,
      createdAt: row.createdAt,
    });
  }
}
