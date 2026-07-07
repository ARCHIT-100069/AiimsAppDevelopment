/**
 * Row → DTO mappers (BDR-0001): the EMR service returns @aiims/db row types;
 * controllers project them to the api-contract DTOs (ISO strings, coding shape).
 */
import type {
  AttachmentResponse,
  ConditionResponse,
  EncounterResponse,
  NoteResponse,
  ObservationResponse,
  OrderResponse,
  ResultResponse,
} from "@aiims/api-contracts";
import type {
  AttachmentRow,
  ConditionRow,
  DiagnosticReportRow,
  EncounterRow,
  NoteRow,
  ObservationRow,
  ServiceRequestRow,
} from "@aiims/db";

export function toEncounterResponse(e: EncounterRow): EncounterResponse {
  return {
    id: e.id,
    appointmentId: e.appointmentId,
    patientId: e.patientId,
    practitionerId: e.practitionerId,
    facilityId: e.facilityId,
    departmentId: e.departmentId,
    class: e.class,
    status: e.status,
    chiefComplaint: e.chiefComplaint,
    signedAt: e.signedAt ? e.signedAt.toISOString() : null,
    signedBy: e.signedBy,
    periodStart: e.periodStart.toISOString(),
    periodEnd: e.periodEnd ? e.periodEnd.toISOString() : null,
    version: e.version,
    createdAt: e.createdAt.toISOString(),
  };
}

export function toNoteResponse(n: NoteRow): NoteResponse {
  return {
    id: n.id,
    noteId: n.noteId,
    encounterId: n.encounterId,
    version: n.version,
    supersedesId: n.supersedesId,
    noteType: n.noteType,
    body: n.body,
    authorId: n.authorId,
    status: n.status,
    amendmentReason: n.amendmentReason,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toObservationResponse(o: ObservationRow): ObservationResponse {
  return {
    id: o.id,
    encounterId: o.encounterId,
    patientId: o.patientId,
    code: { system: o.codeSystem, code: o.code, display: o.display },
    valueNumeric: o.valueNumeric !== null ? Number(o.valueNumeric) : null,
    unit: o.unit,
    valueText: o.valueText,
    effectiveAt: o.effectiveAt.toISOString(),
    recordedBy: o.recordedBy,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toConditionResponse(c: ConditionRow): ConditionResponse {
  return {
    id: c.id,
    encounterId: c.encounterId,
    patientId: c.patientId,
    code: { system: c.codeSystem, code: c.code, display: c.display },
    category: c.category,
    clinicalStatus: c.clinicalStatus,
    note: c.note,
    recordedBy: c.recordedBy,
    version: c.version,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toOrderResponse(o: ServiceRequestRow): OrderResponse {
  return {
    id: o.id,
    encounterId: o.encounterId,
    patientId: o.patientId,
    code: { system: o.codeSystem, code: o.code, display: o.display },
    intent: o.intent,
    status: o.status,
    priority: o.priority,
    note: o.note,
    requesterId: o.requesterId,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toResultResponse(r: DiagnosticReportRow): ResultResponse {
  return {
    id: r.id,
    serviceRequestId: r.serviceRequestId,
    encounterId: r.encounterId,
    patientId: r.patientId,
    status: r.status,
    conclusion: r.conclusion,
    attachmentId: r.attachmentId,
    issuedAt: r.issuedAt.toISOString(),
    filedBy: r.filedBy,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toAttachmentResponse(a: AttachmentRow): AttachmentResponse {
  return {
    id: a.id,
    encounterId: a.encounterId,
    objectKey: a.objectKey,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    sha256: a.sha256,
    uploadedAt: a.uploadedAt.toISOString(),
  };
}
