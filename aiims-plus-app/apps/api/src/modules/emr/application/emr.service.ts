/**
 * EMR application service — the transaction boundary (BDR-0004). Every mutation
 * is ONE tenant-scoped tx: row(s) + outbox event + audit row, atomic. Clinical
 * invariants (encounter-rules): documentation only on an OPEN encounter; sign
 * freezes it (Constitution: doctor-only, enforced by RBAC + the attestation);
 * post-sign corrections are amendments (new note versions, DDR-0013). Large
 * files are handled by presigned URLs via the StorageGateway — bytes never
 * pass through the API. No AI is imported here (Constitution).
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateConditionRequest,
  CreateNoteRequest,
  AmendNoteRequest,
  CreateObservationRequest,
  CreateOrderRequest,
  CreateResultRequest,
  PresignUploadRequest,
  RegisterAttachmentRequest,
} from "@aiims/api-contracts";
import {
  getAttachmentById,
  getEncounterById,
  getLatestNoteVersion,
  getNoteById,
  getPractitionerIdByAppUser,
  getServiceRequestById,
  insertAttachment,
  insertCondition,
  insertDiagnosticReport,
  insertNote,
  insertObservation,
  insertOutboxEvent,
  insertServiceRequest,
  isForeignKeyViolation,
  listConditionsByEncounter,
  listLabResultLines,
  listLatestNotesByEncounter,
  listObservationsByEncounter,
  listResultsByEncounter,
  listServiceRequestsByEncounter,
  markResultReviewed,
  newId,
  signEncounterVersioned,
  updateEncounterChiefComplaint,
  type AttachmentRow,
  type ConditionRow,
  type DiagnosticReportRow,
  type EncounterRow,
  type LabResultLineRow,
  type NoteRow,
  type ObservationRow,
  type ServiceRequestRow,
  type TenantDb,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import {
  CLINICAL_NOTE_AMENDED_V1,
  CLINICAL_NOTE_CREATED_V1,
  CONDITION_RECORDED_V1,
  DIAGNOSTIC_REPORT_FILED_V1,
  ENCOUNTER_SIGNED_V1,
  OBSERVATION_RECORDED_V1,
  SERVICE_REQUEST_PLACED_V1,
} from "@aiims/event-schemas";
import { STORAGE_GATEWAY, type StorageGateway } from "../../../adapters/ports";
import { ConflictError, DomainError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";
import {
  assertDocumentable,
  assertSignable,
  EncounterNotEditableError,
} from "../domain/encounter-rules";

type Actor = { tenantId: string; actorId: string };

export interface PresignUploadResult {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class EmrService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
  ) {}

  /* ------------------------------- helpers ------------------------------- */

  private actor(principal: Principal): Actor {
    return { tenantId: principal.tenantId, actorId: principal.actorId };
  }

  /** Resolve the signed-in clinician's practitioner id (author of the record). */
  private async practitionerId(db: TenantDb, principal: Principal): Promise<string> {
    const id = await getPractitionerIdByAppUser(db, principal.actorId);
    if (!id) throw new DomainError("No practitioner profile is linked to this user");
    return id;
  }

  private async loadOpenEncounter(db: TenantDb, id: string): Promise<EncounterRow> {
    const enc = await getEncounterById(db, id);
    if (!enc) throw new NotFoundError("Encounter not found");
    try {
      assertDocumentable(enc);
    } catch (err) {
      if (err instanceof EncounterNotEditableError) throw new ConflictError(err.message);
      throw err;
    }
    return enc;
  }

  private async auditRow(
    db: TenantDb,
    actor: Actor,
    action: string,
    resourceType: string,
    resourceId: string,
    eventId?: string,
  ): Promise<void> {
    await this.audit.append(db, actor, {
      eventId: eventId ?? newId(),
      action,
      resourceType,
      resourceId,
      occurredAt: new Date(),
    });
  }

  /* ------------------------------ encounter ------------------------------ */

  async getEncounter(principal: Principal, id: string): Promise<EncounterRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const enc = await getEncounterById(db, id);
      if (!enc) throw new NotFoundError("Encounter not found");
      await this.auditRow(db, actor, "encounter.read", "encounter", id);
      return enc;
    });
  }

  async updateChiefComplaint(
    principal: Principal,
    id: string,
    expectedVersion: number,
    chiefComplaint: string,
  ): Promise<EncounterRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      await this.loadOpenEncounter(db, id);
      const row = await updateEncounterChiefComplaint(db, id, expectedVersion, chiefComplaint);
      if (!row) throw new ConflictError("Encounter was modified concurrently or is signed");
      await this.auditRow(db, actor, "encounter.document", "encounter", id);
      return row;
    });
  }

  async sign(principal: Principal, id: string, expectedVersion: number): Promise<EncounterRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const signedBy = await this.practitionerId(db, principal);
      const current = await getEncounterById(db, id);
      if (!current) throw new NotFoundError("Encounter not found");
      try {
        assertSignable(current);
      } catch (err) {
        if (err instanceof EncounterNotEditableError) throw new ConflictError(err.message);
        throw err;
      }
      const row = await signEncounterVersioned(db, id, expectedVersion, signedBy);
      if (!row) throw new ConflictError("Encounter was modified concurrently or already signed");
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "encounter",
        aggregateId: id,
        eventType: ENCOUNTER_SIGNED_V1,
        payload: { encounterId: id, signedBy, version: row.version },
      });
      await this.auditRow(db, actor, "encounter.sign", "encounter", id, eventId);
      return row;
    });
  }

  /* -------------------------------- notes -------------------------------- */

  async createNote(
    principal: Principal,
    encounterId: string,
    req: CreateNoteRequest,
  ): Promise<NoteRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const authorId = await this.practitionerId(db, principal);
      await this.loadOpenEncounter(db, encounterId);
      const noteId = newId();
      const row = await insertNote(db, {
        id: newId(),
        tenantId: principal.tenantId,
        encounterId,
        noteId,
        version: 1,
        noteType: req.noteType,
        body: req.body,
        authorId,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "clinical_note",
        aggregateId: noteId,
        eventType: CLINICAL_NOTE_CREATED_V1,
        payload: { noteId, encounterId },
      });
      await this.auditRow(db, actor, "clinical_note.create", "clinical_note", row.id, eventId);
      return row;
    });
  }

  /** Amend a note — a NEW version (DDR-0013), allowed even after the encounter is signed. */
  async amendNote(principal: Principal, noteId: string, req: AmendNoteRequest): Promise<NoteRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const authorId = await this.practitionerId(db, principal);
      const latest = await getLatestNoteVersion(db, noteId);
      if (!latest) throw new NotFoundError("Note not found");
      const row = await insertNote(db, {
        id: newId(),
        tenantId: principal.tenantId,
        encounterId: latest.encounterId,
        noteId: latest.noteId,
        version: latest.version + 1,
        supersedesId: latest.id,
        noteType: latest.noteType,
        body: req.body,
        authorId,
        amendmentReason: req.reason,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "clinical_note",
        aggregateId: latest.noteId,
        eventType: CLINICAL_NOTE_AMENDED_V1,
        payload: { noteId: latest.noteId, encounterId: latest.encounterId, version: row.version },
      });
      await this.auditRow(db, actor, "clinical_note.amend", "clinical_note", row.id, eventId);
      return row;
    });
  }

  async listNotes(principal: Principal, encounterId: string): Promise<NoteRow[]> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const rows = await listLatestNotesByEncounter(db, encounterId);
      await this.auditRow(db, actor, "clinical_note.read", "encounter", encounterId);
      return rows;
    });
  }

  /* ----------------------------- observations ---------------------------- */

  async recordObservation(
    principal: Principal,
    encounterId: string,
    req: CreateObservationRequest,
  ): Promise<ObservationRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const recordedBy = await this.practitionerId(db, principal);
      const enc = await this.loadOpenEncounter(db, encounterId);
      const row = await insertObservation(db, {
        id: newId(),
        tenantId: principal.tenantId,
        encounterId,
        patientId: enc.patientId,
        code: req.code,
        valueNumeric: req.valueNumeric ?? null,
        unit: req.unit ?? null,
        valueText: req.valueText ?? null,
        ...(req.effectiveAt ? { effectiveAt: new Date(req.effectiveAt) } : {}),
        recordedBy,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "observation",
        aggregateId: row.id,
        eventType: OBSERVATION_RECORDED_V1,
        payload: { observationId: row.id, encounterId },
      });
      await this.auditRow(db, actor, "observation.record", "observation", row.id, eventId);
      return row;
    });
  }

  async listObservations(principal: Principal, encounterId: string): Promise<ObservationRow[]> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const rows = await listObservationsByEncounter(db, encounterId);
      await this.auditRow(db, actor, "observation.read", "encounter", encounterId);
      return rows;
    });
  }

  /* ------------------------------ conditions ----------------------------- */

  async recordCondition(
    principal: Principal,
    encounterId: string,
    req: CreateConditionRequest,
  ): Promise<ConditionRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const recordedBy = await this.practitionerId(db, principal);
      const enc = await this.loadOpenEncounter(db, encounterId);
      const row = await insertCondition(db, {
        id: newId(),
        tenantId: principal.tenantId,
        encounterId,
        patientId: enc.patientId,
        code: req.code,
        category: req.category,
        clinicalStatus: req.clinicalStatus,
        note: req.note ?? null,
        recordedBy,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "condition",
        aggregateId: row.id,
        eventType: CONDITION_RECORDED_V1,
        payload: { conditionId: row.id, encounterId },
      });
      await this.auditRow(db, actor, "condition.record", "condition", row.id, eventId);
      return row;
    });
  }

  async listConditions(principal: Principal, encounterId: string): Promise<ConditionRow[]> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const rows = await listConditionsByEncounter(db, encounterId);
      await this.auditRow(db, actor, "condition.read", "encounter", encounterId);
      return rows;
    });
  }

  /* -------------------------------- orders ------------------------------- */

  async placeOrder(
    principal: Principal,
    encounterId: string,
    req: CreateOrderRequest,
  ): Promise<ServiceRequestRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const requesterId = await this.practitionerId(db, principal);
      const enc = await this.loadOpenEncounter(db, encounterId);
      const row = await insertServiceRequest(db, {
        id: newId(),
        tenantId: principal.tenantId,
        encounterId,
        patientId: enc.patientId,
        code: req.code,
        category: req.category,
        priority: req.priority,
        note: req.note ?? null,
        requesterId,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "service_request",
        aggregateId: row.id,
        eventType: SERVICE_REQUEST_PLACED_V1,
        payload: { serviceRequestId: row.id, encounterId },
      });
      await this.auditRow(db, actor, "service_request.place", "service_request", row.id, eventId);
      return row;
    });
  }

  async listOrders(principal: Principal, encounterId: string): Promise<ServiceRequestRow[]> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const rows = await listServiceRequestsByEncounter(db, encounterId);
      await this.auditRow(db, actor, "service_request.read", "encounter", encounterId);
      return rows;
    });
  }

  /* -------------------------------- results ------------------------------ */

  /** File a result against an order (results may arrive after the encounter is signed). */
  async fileResult(
    principal: Principal,
    orderId: string,
    req: CreateResultRequest,
  ): Promise<DiagnosticReportRow> {
    const actor = this.actor(principal);
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const filedBy = await this.practitionerId(db, principal);
        const order = await getServiceRequestById(db, orderId);
        if (!order) throw new NotFoundError("Order not found");
        const row = await insertDiagnosticReport(db, {
          id: newId(),
          tenantId: principal.tenantId,
          serviceRequestId: orderId,
          encounterId: order.encounterId,
          patientId: order.patientId,
          status: req.status,
          conclusion: req.conclusion,
          attachmentId: req.attachmentId ?? null,
          filedBy,
        });
        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "diagnostic_report",
          aggregateId: row.id,
          eventType: DIAGNOSTIC_REPORT_FILED_V1,
          payload: {
            diagnosticReportId: row.id,
            serviceRequestId: orderId,
            encounterId: order.encounterId,
          },
        });
        await this.auditRow(
          db,
          actor,
          "diagnostic_report.file",
          "diagnostic_report",
          row.id,
          eventId,
        );
        return row;
      });
    } catch (err) {
      if (isForeignKeyViolation(err))
        throw new NotFoundError("Order or attachment not found in this tenant");
      throw err;
    }
  }

  /** The ordering clinician reviews a filed result — the only gate before it
   *  reaches the patient portal (0022). Doctor-only in practice (`result:file`
   *  is not granted to nurse). */
  async reviewResult(
    principal: Principal,
    resultId: string,
    expectedVersion: number,
  ): Promise<DiagnosticReportRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const reviewedBy = await this.practitionerId(db, principal);
      const row = await markResultReviewed(db, resultId, expectedVersion, reviewedBy);
      if (!row) throw new ConflictError("This result was already updated — reload and retry");
      await this.auditRow(db, actor, "diagnostic_report.review", "diagnostic_report", row.id);
      return row;
    });
  }

  async listResults(
    principal: Principal,
    encounterId: string,
  ): Promise<Array<DiagnosticReportRow & { lines: LabResultLineRow[] }>> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const rows = await listResultsByEncounter(db, encounterId);
      await this.auditRow(db, actor, "diagnostic_report.read", "encounter", encounterId);
      // The doctor needs the actual analyte values, not just the written
      // impression — a "High WBC" flag matters more here than anywhere else.
      // Sequential: these queries share this transaction's one pg client, so
      // concurrent awaits on it are deprecated (pg#9 removes support).
      const out: Array<DiagnosticReportRow & { lines: LabResultLineRow[] }> = [];
      for (const r of rows) {
        out.push({ ...r, lines: await listLabResultLines(db, r.id) });
      }
      return out;
    });
  }

  /* ------------------------------ attachments ---------------------------- */

  async presignUpload(
    principal: Principal,
    encounterId: string,
    req: PresignUploadRequest,
  ): Promise<PresignUploadResult> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const enc = await getEncounterById(db, encounterId);
      if (!enc) throw new NotFoundError("Encounter not found");
      const safeName = req.fileName.replace(/[^\w.-]/g, "_");
      const objectKey = `t/${principal.tenantId}/enc/${encounterId}/${newId()}/${safeName}`;
      const { url, expiresInSeconds } = await this.storage.presignUpload({
        objectKey,
        contentType: req.contentType,
      });
      await this.auditRow(db, actor, "attachment.presign_upload", "encounter", encounterId);
      return { objectKey, uploadUrl: url, expiresInSeconds };
    });
  }

  async registerAttachment(
    principal: Principal,
    encounterId: string,
    req: RegisterAttachmentRequest,
  ): Promise<AttachmentRow> {
    const actor = this.actor(principal);
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const enc = await getEncounterById(db, encounterId);
        if (!enc) throw new NotFoundError("Encounter not found");
        const row = await insertAttachment(db, {
          id: newId(),
          tenantId: principal.tenantId,
          encounterId,
          objectKey: req.objectKey,
          contentType: req.contentType,
          sizeBytes: req.sizeBytes,
          sha256: req.sha256 ?? null,
        });
        await this.auditRow(db, actor, "attachment.register", "attachment", row.id);
        return row;
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new NotFoundError("Encounter not found in this tenant");
      throw err;
    }
  }

  async presignDownload(
    principal: Principal,
    attachmentId: string,
  ): Promise<{ objectKey: string; downloadUrl: string; expiresInSeconds: number }> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const att = await getAttachmentById(db, attachmentId);
      if (!att) throw new NotFoundError("Attachment not found");
      const { url, expiresInSeconds } = await this.storage.presignDownload({
        objectKey: att.objectKey,
      });
      await this.auditRow(db, actor, "attachment.presign_download", "attachment", attachmentId);
      return { objectKey: att.objectKey, downloadUrl: url, expiresInSeconds };
    });
  }

  /* --------------------------------- FHIR -------------------------------- */

  /** Everything needed to regenerate the FHIR bundle (read; audited by callers). */
  async encounterEverything(principal: Principal, encounterId: string) {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const encounter = await getEncounterById(db, encounterId);
      if (!encounter) throw new NotFoundError("Encounter not found");
      // Sequential: these queries share this transaction's one pg client, so
      // concurrent awaits on it are deprecated (pg#9 removes support).
      const observations = await listObservationsByEncounter(db, encounterId);
      const conditions = await listConditionsByEncounter(db, encounterId);
      const notes = await listLatestNotesByEncounter(db, encounterId);
      const orders = await listServiceRequestsByEncounter(db, encounterId);
      const results = await listResultsByEncounter(db, encounterId);
      await this.auditRow(db, actor, "encounter.fhir_read", "encounter", encounterId);
      return { encounter, observations, conditions, notes, orders, results };
    });
  }

  async getNote(principal: Principal, id: string): Promise<NoteRow | undefined> {
    return this.uow.withTenant(this.actor(principal), (db) => getNoteById(db, id));
  }
}
