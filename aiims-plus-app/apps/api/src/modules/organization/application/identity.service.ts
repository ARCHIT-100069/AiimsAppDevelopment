/**
 * Identity application service (Stage 1): app users + role assignment within
 * a tenant. Same atomic write+outbox+audit discipline; role assignment is
 * idempotent (clarification #3) — a replay changes nothing and emits nothing.
 */
import { Injectable } from "@nestjs/common";
import type { AssignRoleRequest, CreateUserRequest } from "@aiims/api-contracts";
import {
  assignRoleIdempotent,
  findRoleByCode,
  insertAppUser,
  insertOutboxEvent,
  isForeignKeyViolation,
  isUniqueViolation,
  listUsers,
  newId,
  roleCodesForUsers,
  updateAppUserStatus,
  type AppUserRow,
  type Keyset,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { USER_CREATED_V1, USER_ROLE_ASSIGNED_V1 } from "@aiims/event-schemas";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

export interface UserWithRoles extends AppUserRow {
  roles: string[];
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  async createUser(principal: Principal, req: CreateUserRequest): Promise<UserWithRoles> {
    try {
      return await this.uow.withTenant(
        { tenantId: principal.tenantId, actorId: principal.actorId },
        async (db) => {
          const user = await insertAppUser(db, {
            id: newId(),
            tenantId: principal.tenantId,
            keycloakSub: req.keycloakSub,
            displayName: req.displayName,
          });
          const eventId = newId();
          await insertOutboxEvent(db, {
            id: eventId,
            tenantId: principal.tenantId,
            aggregateType: "app_user",
            aggregateId: user.id,
            eventType: USER_CREATED_V1,
            payload: { userId: user.id },
          });
          await this.audit.append(
            db,
            { tenantId: principal.tenantId, actorId: principal.actorId },
            {
              eventId,
              action: "user.create",
              resourceType: "app_user",
              resourceId: user.id,
              occurredAt: new Date(),
            },
          );
          return { ...user, roles: [] };
        },
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError("This identity is already mapped to a user");
      }
      throw err;
    }
  }

  async assignRole(principal: Principal, userId: string, req: AssignRoleRequest): Promise<void> {
    try {
      await this.uow.withTenant(
        { tenantId: principal.tenantId, actorId: principal.actorId },
        async (db) => {
          const role = await findRoleByCode(db, req.roleCode);
          if (!role) throw new NotFoundError(`Role "${req.roleCode}" not found`);

          // RLS scopes the visibility check; FK enforces user/department reality.
          await assignRoleIdempotent(db, {
            tenantId: principal.tenantId,
            userId,
            roleId: role.id,
            ...(req.departmentId ? { departmentId: req.departmentId } : {}),
          });

          const eventId = newId();
          await insertOutboxEvent(db, {
            id: eventId,
            tenantId: principal.tenantId,
            aggregateType: "app_user",
            aggregateId: userId,
            eventType: USER_ROLE_ASSIGNED_V1,
            payload: {
              userId,
              roleCode: req.roleCode,
              ...(req.departmentId ? { departmentId: req.departmentId } : {}),
            },
          });
          await this.audit.append(
            db,
            { tenantId: principal.tenantId, actorId: principal.actorId },
            {
              eventId,
              action: "user.assign_role",
              resourceType: "app_user",
              resourceId: userId,
              occurredAt: new Date(),
            },
          );
        },
      );
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError("User or department not found in this tenant");
      }
      throw err;
    }
  }

  /** Deactivate/reactivate a staff login (blocks/restores session resolution). */
  async updateStatus(
    principal: Principal,
    userId: string,
    expectedVersion: number,
    status: "active" | "disabled",
  ): Promise<UserWithRoles> {
    return this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      async (db) => {
        const updated = await updateAppUserStatus(db, userId, expectedVersion, status);
        if (!updated) {
          throw new ConflictError(
            "Staff account was changed since you loaded it — refresh and retry",
          );
        }
        await this.audit.append(
          db,
          { tenantId: principal.tenantId, actorId: principal.actorId },
          {
            eventId: newId(),
            action: status === "active" ? "user.reactivate" : "user.deactivate",
            resourceType: "app_user",
            resourceId: userId,
            occurredAt: new Date(),
          },
        );
        const roles = await roleCodesForUsers(db, [userId]);
        return { ...updated, roles: roles.get(userId) ?? [] };
      },
    );
  }

  async listUsers(principal: Principal, limit: number, k?: Keyset): Promise<UserWithRoles[]> {
    return this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      async (db) => {
        const users = await listUsers(db, limit, k);
        const roles = await roleCodesForUsers(
          db,
          users.map((u) => u.id),
        );
        return users.map((u) => ({ ...u, roles: roles.get(u.id) ?? [] }));
      },
    );
  }
}
