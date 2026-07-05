/**
 * Org-structure application service (Stage 1): organization → facility →
 * department. Every write is one tenant-scoped transaction = business row +
 * outbox event + audit row (BDR-0004, Stage 0 pattern preserved).
 *
 * Duplicate-safety: natural-key uniques reject inconsistent replays → 409;
 * cross-tenant / missing parents are structurally impossible (composite FKs,
 * DDR-0008) and surface as 404.
 */
import { Injectable } from "@nestjs/common";
import type {
  CreateDepartmentRequest,
  CreateFacilityRequest,
  CreateOrganizationRequest,
} from "@aiims/api-contracts";
import {
  insertDepartment,
  insertFacility,
  insertOrganization,
  insertOutboxEvent,
  isForeignKeyViolation,
  isUniqueViolation,
  listDepartments,
  listFacilities,
  listOrganizations,
  newId,
  type DepartmentRow,
  type FacilityRow,
  type Keyset,
  type OrganizationRow,
  type TenantDb,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import {
  DEPARTMENT_CREATED_V1,
  FACILITY_CREATED_V1,
  ORGANIZATION_CREATED_V1,
} from "@aiims/event-schemas";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

@Injectable()
export class OrgStructureService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  private async audited<T extends { id: string }>(
    principal: Principal,
    action: string,
    resourceType: string,
    eventType: string,
    payload: (row: T) => Record<string, unknown>,
    write: (db: TenantDb) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.uow.withTenant(
        { tenantId: principal.tenantId, actorId: principal.actorId },
        async (db) => {
          const row = await write(db);
          const eventId = newId();
          await insertOutboxEvent(db, {
            id: eventId,
            tenantId: principal.tenantId,
            aggregateType: resourceType,
            aggregateId: row.id,
            eventType,
            payload: payload(row),
          });
          await this.audit.append(
            db,
            { tenantId: principal.tenantId, actorId: principal.actorId },
            { eventId, action, resourceType, resourceId: row.id, occurredAt: new Date() },
          );
          return row;
        },
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(`${resourceType} already exists`);
      if (isForeignKeyViolation(err))
        throw new NotFoundError(`Parent of ${resourceType} not found`);
      throw err;
    }
  }

  createOrganization(
    principal: Principal,
    req: CreateOrganizationRequest,
  ): Promise<OrganizationRow> {
    return this.audited(
      principal,
      "organization.create",
      "organization",
      ORGANIZATION_CREATED_V1,
      (row) => ({ organizationId: row.id }),
      (db) =>
        insertOrganization(db, {
          id: newId(),
          tenantId: principal.tenantId,
          name: req.name,
          type: req.type,
        }),
    );
  }

  createFacility(principal: Principal, req: CreateFacilityRequest): Promise<FacilityRow> {
    return this.audited(
      principal,
      "facility.create",
      "facility",
      FACILITY_CREATED_V1,
      (row) => ({ facilityId: row.id, organizationId: row.organizationId }),
      (db) =>
        insertFacility(db, {
          id: newId(),
          tenantId: principal.tenantId,
          organizationId: req.organizationId,
          name: req.name,
          timezone: req.timezone,
          ...(req.address ? { address: req.address } : {}),
        }),
    );
  }

  createDepartment(principal: Principal, req: CreateDepartmentRequest): Promise<DepartmentRow> {
    return this.audited(
      principal,
      "department.create",
      "department",
      DEPARTMENT_CREATED_V1,
      (row) => ({ departmentId: row.id, facilityId: row.facilityId, code: row.code }),
      (db) =>
        insertDepartment(db, {
          id: newId(),
          tenantId: principal.tenantId,
          facilityId: req.facilityId,
          name: req.name,
          code: req.code,
        }),
    );
  }

  listOrganizations(principal: Principal, limit: number, k?: Keyset): Promise<OrganizationRow[]> {
    return this.uow.withTenant({ tenantId: principal.tenantId, actorId: principal.actorId }, (db) =>
      listOrganizations(db, limit, k),
    );
  }

  listFacilities(principal: Principal, limit: number, k?: Keyset): Promise<FacilityRow[]> {
    return this.uow.withTenant({ tenantId: principal.tenantId, actorId: principal.actorId }, (db) =>
      listFacilities(db, limit, k),
    );
  }

  listDepartments(principal: Principal, limit: number, k?: Keyset): Promise<DepartmentRow[]> {
    return this.uow.withTenant({ tenantId: principal.tenantId, actorId: principal.actorId }, (db) =>
      listDepartments(db, limit, k),
    );
  }
}
