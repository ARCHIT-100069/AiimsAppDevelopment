/**
 * Tenancy application service — tenant REGISTRY operations (platform
 * operators only). The transaction boundary (BDR-0004): tenant row + default
 * roles + optional bootstrap admin + outbox events + audit rows commit
 * atomically, all under the NEW tenant's RLS context.
 *
 * Idempotent by design (founder clarification #3): replaying a create with
 * the same id+slug returns the existing tenant and writes nothing new.
 */
import { Injectable } from "@nestjs/common";
import type { CreateTenantRequest } from "@aiims/api-contracts";
import {
  assignRoleIdempotent,
  ensureTenantRoles,
  insertAppUser,
  insertOutboxEvent,
  isUniqueViolation,
  listTenants,
  insertTenantIdempotent,
  newId,
  type TenantRow,
} from "@aiims/db";
import { ROLE_CODES, type PlatformPrincipal } from "@aiims/domain-types";
import { TENANT_CREATED_V1, USER_CREATED_V1 } from "@aiims/event-schemas";
import { ConflictError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

export interface CreateTenantResult {
  tenant: TenantRow;
  created: boolean;
}

@Injectable()
export class TenancyService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  async createTenant(
    admin: PlatformPrincipal,
    req: CreateTenantRequest,
  ): Promise<CreateTenantResult> {
    const tenantId = req.id ?? newId();

    try {
      return await this.uow.withTenant({ tenantId, actorId: admin.actorId }, async (db) => {
        const { tenant, created } = await insertTenantIdempotent(db, {
          id: tenantId,
          slug: req.slug,
          name: req.name,
        });

        if (!created) {
          if (tenant.id !== req.id) {
            // Slug held by a different tenant — a real conflict, not a replay.
            throw new ConflictError(`Slug "${req.slug}" is already in use`);
          }
          return { tenant, created: false }; // idempotent replay: no-op
        }

        const roleIds = await ensureTenantRoles(db, tenantId, ROLE_CODES);

        const tenantEventId = newId();
        const occurredAt = new Date();
        await insertOutboxEvent(db, {
          id: tenantEventId,
          tenantId,
          aggregateType: "tenant",
          aggregateId: tenantId,
          eventType: TENANT_CREATED_V1,
          payload: { tenantId, slug: req.slug },
        });
        await this.audit.append(
          db,
          { tenantId, actorId: admin.actorId },
          {
            eventId: tenantEventId,
            action: "tenant.create",
            resourceType: "tenant",
            resourceId: tenantId,
            occurredAt,
          },
        );

        if (req.initialAdmin) {
          const user = await insertAppUser(db, {
            id: newId(),
            tenantId,
            keycloakSub: req.initialAdmin.keycloakSub,
            displayName: req.initialAdmin.displayName,
          });
          const adminRoleId = roleIds.get("admin");
          if (!adminRoleId) throw new Error("tenant role seed missing admin role");
          await assignRoleIdempotent(db, { tenantId, userId: user.id, roleId: adminRoleId });

          const userEventId = newId();
          await insertOutboxEvent(db, {
            id: userEventId,
            tenantId,
            aggregateType: "app_user",
            aggregateId: user.id,
            eventType: USER_CREATED_V1,
            payload: { userId: user.id },
          });
          await this.audit.append(
            db,
            { tenantId, actorId: admin.actorId },
            {
              eventId: userEventId,
              action: "user.create",
              resourceType: "app_user",
              resourceId: user.id,
              occurredAt: new Date(),
            },
          );
        }

        return { tenant, created: true };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // e.g. initialAdmin.keycloakSub already mapped to another tenant.
        throw new ConflictError("A resource in this request already exists");
      }
      throw err;
    }
  }

  async listTenants(limit: number): Promise<TenantRow[]> {
    return listTenants(this.uow.rawPool, limit);
  }
}
