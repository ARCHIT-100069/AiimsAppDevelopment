/**
 * Practitioner application service — the transaction boundary (BDR-0004).
 * create/update = one tenant-scoped tx: row + outbox event + audit row,
 * atomic. app_user_id is set only at creation and never updated (immutable).
 *
 * Decision i: creating a practitioner whose linked app_user lacks a clinical
 * role is ALLOWED but returns a structured warning AND emits a dedicated
 * outbox event + audit row (practitioner.role_warning.v1) — non-blocking.
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreatePractitionerRequest,
  PractitionerWarning,
  UpdatePractitionerRequest,
} from "@aiims/api-contracts";
import {
  insertOutboxEvent,
  isForeignKeyViolation,
  isUniqueViolation,
  newId,
  type Keyset,
} from "@aiims/db";
import { CLINICAL_ROLES } from "@aiims/authz";
import type { Principal } from "@aiims/domain-types";
import {
  PRACTITIONER_CREATED_V1,
  PRACTITIONER_ROLE_WARNING_V1,
  PRACTITIONER_UPDATED_V1,
} from "@aiims/event-schemas";
import { ConflictError, DomainError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";
import { InvalidPractitionerError, Practitioner } from "../domain/practitioner";
import {
  PRACTITIONER_REPOSITORY,
  type PractitionerRepository,
} from "../ports/practitioner-repository.port";

export interface RegisterPractitionerResult {
  practitioner: Practitioner;
  warnings: PractitionerWarning[];
}

@Injectable()
export class PractitionerService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(PRACTITIONER_REPOSITORY) private readonly practitioners: PractitionerRepository,
  ) {}

  async create(
    principal: Principal,
    req: CreatePractitionerRequest,
  ): Promise<RegisterPractitionerResult> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        // Advisory clinical-role check (decision i) — inside the tx, same context.
        const roles = await this.practitioners.appUserRoleCodes(db, req.appUserId);
        const isClinical = roles.some((r) => (CLINICAL_ROLES as readonly string[]).includes(r));
        const warnings: PractitionerWarning[] = isClinical
          ? []
          : [
              {
                code: "LINKED_USER_NOT_CLINICAL",
                message:
                  "The linked user has no clinical role (doctor/nurse). The practitioner was created; verify this is intended.",
              },
            ];

        // Default the name from the linked user's display name (decision c).
        const fallback =
          (await this.practitioners.appUserDisplayName(db, req.appUserId)) ?? "Unknown";
        const [given, ...rest] = fallback.trim().split(/\s+/);
        let practitioner: Practitioner;
        try {
          practitioner = Practitioner.register({
            id: newId(),
            tenantId: principal.tenantId,
            appUserId: req.appUserId,
            nameGiven: req.nameGiven ?? given ?? "Unknown",
            nameFamily: req.nameFamily ?? (rest.join(" ") || given || "Unknown"),
            registrationNo: req.registrationNo,
            departmentId: req.departmentId ?? null,
            specialties: req.specialties,
          });
        } catch (err) {
          if (err instanceof InvalidPractitionerError) throw new DomainError(err.message);
          throw err;
        }

        await this.practitioners.insert(db, practitioner);

        const createdEventId = newId();
        await insertOutboxEvent(db, {
          id: createdEventId,
          tenantId: principal.tenantId,
          aggregateType: "practitioner",
          aggregateId: practitioner.props.id,
          eventType: PRACTITIONER_CREATED_V1,
          payload: { practitionerId: practitioner.props.id, appUserId: req.appUserId },
        });
        await this.audit.append(db, actor, {
          eventId: createdEventId,
          action: "practitioner.create",
          resourceType: "practitioner",
          resourceId: practitioner.props.id,
          occurredAt: new Date(),
        });

        // Decision i: dedicated event + audit row for the non-blocking warning.
        if (warnings.length) {
          const warnEventId = newId();
          await insertOutboxEvent(db, {
            id: warnEventId,
            tenantId: principal.tenantId,
            aggregateType: "practitioner",
            aggregateId: practitioner.props.id,
            eventType: PRACTITIONER_ROLE_WARNING_V1,
            payload: { practitionerId: practitioner.props.id, appUserId: req.appUserId },
          });
          await this.audit.append(db, actor, {
            eventId: warnEventId,
            action: "practitioner.role_warning",
            resourceType: "practitioner",
            resourceId: practitioner.props.id,
            occurredAt: new Date(),
          });
        }

        return { practitioner, warnings };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          "A practitioner already exists for this user or registration number",
        );
      }
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError("Linked user or department not found in this tenant");
      }
      throw err;
    }
  }

  async getById(principal: Principal, id: string): Promise<Practitioner> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const practitioner = await this.practitioners.findById(db, id);
      if (!practitioner) throw new NotFoundError("Practitioner not found");
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "practitioner.read",
        resourceType: "practitioner",
        resourceId: id,
        occurredAt: new Date(),
      });
      return practitioner;
    });
  }

  async search(
    principal: Principal,
    input: {
      q?: string;
      registrationNo?: string;
      departmentId?: string;
      limit: number;
      cursor?: Keyset;
    },
  ): Promise<Practitioner[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, (db) =>
      this.practitioners.search(db, {
        limit: input.limit,
        ...(input.q ? { q: input.q } : {}),
        ...(input.registrationNo ? { registrationNo: input.registrationNo } : {}),
        ...(input.departmentId ? { departmentId: input.departmentId } : {}),
        ...(input.cursor ? { cursor: input.cursor } : {}),
      }),
    );
  }

  async update(
    principal: Principal,
    id: string,
    expectedVersion: number,
    req: UpdatePractitionerRequest,
  ): Promise<Practitioner> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const result = await this.practitioners.update(db, id, expectedVersion, {
          ...(req.nameGiven !== undefined ? { nameGiven: req.nameGiven } : {}),
          ...(req.nameFamily !== undefined ? { nameFamily: req.nameFamily } : {}),
          ...(req.departmentId !== undefined ? { departmentId: req.departmentId } : {}),
          ...(req.status !== undefined ? { status: req.status } : {}),
          ...(req.specialties !== undefined ? { specialties: req.specialties } : {}),
        });
        if (result === "missing") throw new NotFoundError("Practitioner not found");
        if (result === "conflict") {
          throw new ConflictError("Practitioner was modified concurrently — refetch and retry");
        }

        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "practitioner",
          aggregateId: id,
          eventType: PRACTITIONER_UPDATED_V1,
          payload: { practitionerId: id, version: result.props.version },
        });
        await this.audit.append(db, actor, {
          eventId,
          action: "practitioner.update",
          resourceType: "practitioner",
          resourceId: id,
          occurredAt: new Date(),
        });
        return result;
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw new NotFoundError("Department not found in this tenant");
      }
      throw err;
    }
  }
}
