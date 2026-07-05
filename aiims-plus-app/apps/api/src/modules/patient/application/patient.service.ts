/**
 * Patient application service — the transaction boundary (BDR-0004).
 * register: idempotency check + MRN issuance + patient row + outbox event(s)
 * + audit row(s), ONE atomic transaction. External (mock) ABDM calls happen
 * BEFORE the transaction — never inside it (BDR-0004: no external calls
 * in the unit of work).
 *
 * PHI reads are audited too (Blueprint §21 "everything auditable"): read
 * audit rows are standalone (no outbox event — reads are not state changes,
 * DDR-0007 events describe state), using the same hash chain.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { CreatePatientRequest, UpdatePatientRequest } from "@aiims/api-contracts";
import {
  findIdempotentResource,
  insertOutboxEvent,
  issueMrn,
  newId,
  saveIdempotencyKey,
  type Keyset,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import {
  PATIENT_ABHA_LINKED_V1,
  PATIENT_REGISTERED_V1,
  PATIENT_UPDATED_V1,
} from "@aiims/event-schemas";
import { ABDM_GATEWAY, type AbdmGateway } from "../../../adapters/ports";
import { ConflictError, DomainError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";
import { InvalidPatientError, Patient } from "../domain/patient";
import {
  PATIENT_REPOSITORY,
  type IdentifierKind,
  type PatientRepository,
} from "../ports/patient-repository.port";

const CREATE_ENDPOINT = "POST /v1/patients";

export interface RegisterResult {
  patient: Patient;
  created: boolean;
}

@Injectable()
export class PatientService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(PATIENT_REPOSITORY) private readonly patients: PatientRepository,
    @Inject(ABDM_GATEWAY) private readonly abdm: AbdmGateway,
  ) {}

  async register(
    principal: Principal,
    req: CreatePatientRequest,
    idempotencyKey: string,
  ): Promise<RegisterResult> {
    // External seam FIRST, outside the transaction (BDR-0004/BDR-0008).
    let abhaNumber: string | null = null;
    let abhaAddress: string | null = req.abhaAddress ?? null;
    let abhaLinked = false;
    if (req.requestAbha) {
      const created = await this.abdm.createAbha();
      abhaNumber = created.abhaNumber;
      abhaAddress = created.abhaAddress;
      abhaLinked = true;
    } else if (req.abhaAddress) {
      const { verified } = await this.abdm.verifyAbha(req.abhaAddress);
      if (!verified) throw new DomainError("ABHA address could not be verified");
      abhaLinked = true;
    }

    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      // Idempotent replay (APDR-0006): same key ⇒ the original resource.
      const existingId = await findIdempotentResource(db, CREATE_ENDPOINT, idempotencyKey);
      if (existingId) {
        const existing = await this.patients.findById(db, existingId);
        if (!existing) throw new ConflictError("Idempotency key maps to a missing resource");
        return { patient: existing, created: false };
      }

      const mrn = await issueMrn(db, principal.tenantId);
      let patient: Patient;
      try {
        patient = Patient.register({
          id: newId(),
          tenantId: principal.tenantId,
          mrn,
          nameGiven: req.nameGiven,
          nameFamily: req.nameFamily,
          gender: req.gender,
          birthDate: req.birthDate,
          phone: req.phone ?? null,
          email: req.email ?? null,
          abhaNumber,
          abhaAddress,
          address: req.address ?? null,
        });
      } catch (err) {
        if (err instanceof InvalidPatientError) throw new DomainError(err.message);
        throw err;
      }

      await this.patients.insert(db, patient);

      const registeredEventId = newId();
      await insertOutboxEvent(db, {
        id: registeredEventId,
        tenantId: principal.tenantId,
        aggregateType: "patient",
        aggregateId: patient.props.id,
        eventType: PATIENT_REGISTERED_V1,
        payload: { patientId: patient.props.id }, // references only — no PHI
      });
      await this.audit.append(db, actor, {
        eventId: registeredEventId,
        action: "patient.register",
        resourceType: "patient",
        resourceId: patient.props.id,
        occurredAt: new Date(),
      });

      if (abhaLinked) {
        const abhaEventId = newId();
        await insertOutboxEvent(db, {
          id: abhaEventId,
          tenantId: principal.tenantId,
          aggregateType: "patient",
          aggregateId: patient.props.id,
          eventType: PATIENT_ABHA_LINKED_V1,
          payload: { patientId: patient.props.id, provider: "mock" },
        });
        await this.audit.append(db, actor, {
          eventId: abhaEventId,
          action: "patient.abha_link",
          resourceType: "patient",
          resourceId: patient.props.id,
          occurredAt: new Date(),
        });
      }

      await saveIdempotencyKey(db, {
        tenantId: principal.tenantId,
        endpoint: CREATE_ENDPOINT,
        key: idempotencyKey,
        resourceId: patient.props.id,
      });

      return { patient, created: true };
    });
  }

  async getById(principal: Principal, id: string): Promise<Patient> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const patient = await this.patients.findById(db, id);
      if (!patient) throw new NotFoundError("Patient not found");
      // PHI access is audited (Blueprint §21); reads emit no domain event.
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "patient.read",
        resourceType: "patient",
        resourceId: id,
        occurredAt: new Date(),
      });
      return patient;
    });
  }

  async search(
    principal: Principal,
    input: {
      q?: string;
      mrn?: string;
      identifier?: { kind: IdentifierKind; value: string };
      limit: number;
      cursor?: Keyset;
    },
  ): Promise<Patient[]> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const results = await this.patients.search(db, {
        tenantId: principal.tenantId,
        limit: input.limit,
        ...(input.q ? { q: input.q } : {}),
        ...(input.mrn ? { mrn: input.mrn } : {}),
        ...(input.identifier ? { identifier: input.identifier } : {}),
        ...(input.cursor
          ? {
              cursor: {
                beforeCreatedAt: input.cursor.beforeCreatedAt,
                beforeId: input.cursor.beforeId,
              },
            }
          : {}),
      });
      // One audit row per search ACTION; the terms are PHI and never audited.
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "patient.search",
        resourceType: "patient",
        resourceId: principal.tenantId, // action-level entry; no single resource
        occurredAt: new Date(),
      });
      return results;
    });
  }

  async update(
    principal: Principal,
    id: string,
    expectedVersion: number,
    req: UpdatePatientRequest,
  ): Promise<Patient> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const result = await this.patients.update(db, id, expectedVersion, {
        ...(req.nameGiven !== undefined ? { nameGiven: req.nameGiven } : {}),
        ...(req.nameFamily !== undefined ? { nameFamily: req.nameFamily } : {}),
        ...(req.gender !== undefined ? { gender: req.gender } : {}),
        ...(req.birthDate !== undefined ? { birthDate: req.birthDate } : {}),
        ...(req.phone !== undefined ? { phone: req.phone } : {}),
        ...(req.email !== undefined ? { email: req.email } : {}),
        ...(req.address !== undefined ? { address: req.address } : {}),
      });
      if (result === "missing") throw new NotFoundError("Patient not found");
      if (result === "conflict") {
        throw new ConflictError("Patient was modified concurrently — refetch and retry");
      }

      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "patient",
        aggregateId: id,
        eventType: PATIENT_UPDATED_V1,
        payload: { patientId: id, version: result.props.version },
      });
      await this.audit.append(db, actor, {
        eventId,
        action: "patient.update",
        resourceType: "patient",
        resourceId: id,
        occurredAt: new Date(),
      });
      return result;
    });
  }
}
