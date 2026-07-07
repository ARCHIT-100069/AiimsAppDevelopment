/**
 * Stage 5 data-access helpers (EMR). Drizzle stays confined here. Every helper
 * requires a tenant-scoped transaction (DDR-0002). Clinical notes are
 * append-only (DDR-0013): amend inserts a new version, never mutating a prior
 * one. The encounter sign lifecycle is versioned (optimistic concurrency).
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";
import type { EncounterRow } from "./scheduling-queries";

export interface Coding {
  system: string;
  code: string;
  display: string;
}

/* ------------------------------ encounter -------------------------------- */

/** Update the chief complaint while in_progress (optimistic concurrency). */
export async function updateEncounterChiefComplaint(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  chiefComplaint: string,
): Promise<EncounterRow | undefined> {
  const [row] = await db
    .update(s.encounter)
    .set({ chiefComplaint, version: sql`${s.encounter.version} + 1`, updatedAt: sql`now()` })
    .where(
      and(
        eq(s.encounter.id, id),
        eq(s.encounter.version, expectedVersion),
        eq(s.encounter.status, "in_progress"),
        isNull(s.encounter.deletedAt),
      ),
    )
    .returning();
  return row as EncounterRow | undefined;
}

/** Sign/finalize (Constitution: human-only, enforced upstream). in_progress → finished. */
export async function signEncounterVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  signedBy: string,
): Promise<EncounterRow | undefined> {
  const [row] = await db
    .update(s.encounter)
    .set({
      status: "finished",
      signedBy,
      signedAt: sql`now()`,
      periodEnd: sql`now()`,
      version: sql`${s.encounter.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(s.encounter.id, id),
        eq(s.encounter.version, expectedVersion),
        eq(s.encounter.status, "in_progress"),
        isNull(s.encounter.deletedAt),
      ),
    )
    .returning();
  return row as EncounterRow | undefined;
}

/* ----------------------------- clinical note ----------------------------- */

export interface NoteRow {
  id: string;
  tenantId: string;
  encounterId: string;
  noteId: string;
  version: number;
  supersedesId: string | null;
  noteType: "progress" | "consult" | "discharge";
  body: string;
  authorId: string;
  status: "active" | "amended";
  amendmentReason: string | null;
  createdAt: Date;
}

const noteColumns = {
  id: s.clinicalNote.id,
  tenantId: s.clinicalNote.tenantId,
  encounterId: s.clinicalNote.encounterId,
  noteId: s.clinicalNote.noteId,
  version: s.clinicalNote.version,
  supersedesId: s.clinicalNote.supersedesId,
  noteType: s.clinicalNote.noteType,
  body: s.clinicalNote.body,
  authorId: s.clinicalNote.authorId,
  status: s.clinicalNote.status,
  amendmentReason: s.clinicalNote.amendmentReason,
  createdAt: s.clinicalNote.createdAt,
} as const;

export async function insertNote(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    encounterId: string;
    noteId: string;
    version: number;
    supersedesId?: string | null;
    noteType: "progress" | "consult" | "discharge";
    body: string;
    authorId: string;
    amendmentReason?: string | null;
  },
): Promise<NoteRow> {
  const [row] = await db
    .insert(s.clinicalNote)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      noteId: input.noteId,
      version: input.version,
      supersedesId: input.supersedesId ?? null,
      noteType: input.noteType,
      body: input.body,
      authorId: input.authorId,
      amendmentReason: input.amendmentReason ?? null,
    })
    .returning(noteColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getNoteById(db: TenantDb, id: string): Promise<NoteRow | undefined> {
  const [row] = await db
    .select(noteColumns)
    .from(s.clinicalNote)
    .where(eq(s.clinicalNote.id, id))
    .limit(1);
  return row;
}

/** Latest version row for a logical note (max version). */
export async function getLatestNoteVersion(
  db: TenantDb,
  noteId: string,
): Promise<NoteRow | undefined> {
  const [row] = await db
    .select(noteColumns)
    .from(s.clinicalNote)
    .where(eq(s.clinicalNote.noteId, noteId))
    .orderBy(desc(s.clinicalNote.version))
    .limit(1);
  return row;
}

/** Latest version of each note in an encounter (DISTINCT ON note_id). */
export async function listLatestNotesByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<NoteRow[]> {
  return db
    .selectDistinctOn([s.clinicalNote.noteId], noteColumns)
    .from(s.clinicalNote)
    .where(and(eq(s.clinicalNote.encounterId, encounterId), isNull(s.clinicalNote.deletedAt)))
    .orderBy(s.clinicalNote.noteId, desc(s.clinicalNote.version));
}

/* ------------------------------ observation ------------------------------ */

export interface ObservationRow {
  id: string;
  encounterId: string;
  patientId: string;
  codeSystem: string;
  code: string;
  display: string;
  valueNumeric: string | null;
  unit: string | null;
  valueText: string | null;
  effectiveAt: Date;
  recordedBy: string;
  version: number;
  createdAt: Date;
}

const obsColumns = {
  id: s.observation.id,
  encounterId: s.observation.encounterId,
  patientId: s.observation.patientId,
  codeSystem: s.observation.codeSystem,
  code: s.observation.code,
  display: s.observation.display,
  valueNumeric: s.observation.valueNumeric,
  unit: s.observation.unit,
  valueText: s.observation.valueText,
  effectiveAt: s.observation.effectiveAt,
  recordedBy: s.observation.recordedBy,
  version: s.observation.version,
  createdAt: s.observation.createdAt,
} as const;

export async function insertObservation(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    code: Coding;
    valueNumeric?: number | null;
    unit?: string | null;
    valueText?: string | null;
    effectiveAt?: Date;
    recordedBy: string;
  },
): Promise<ObservationRow> {
  const [row] = await db
    .insert(s.observation)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      codeSystem: input.code.system,
      code: input.code.code,
      display: input.code.display,
      valueNumeric: input.valueNumeric != null ? String(input.valueNumeric) : null,
      unit: input.unit ?? null,
      valueText: input.valueText ?? null,
      ...(input.effectiveAt ? { effectiveAt: input.effectiveAt } : {}),
      recordedBy: input.recordedBy,
    })
    .returning(obsColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listObservationsByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<ObservationRow[]> {
  return db
    .select(obsColumns)
    .from(s.observation)
    .where(and(eq(s.observation.encounterId, encounterId), isNull(s.observation.deletedAt)))
    .orderBy(desc(s.observation.effectiveAt));
}

/* ------------------------------- condition ------------------------------- */

export interface ConditionRow {
  id: string;
  encounterId: string;
  patientId: string;
  codeSystem: string;
  code: string;
  display: string;
  category: "diagnosis" | "problem";
  clinicalStatus: "active" | "resolved";
  note: string | null;
  recordedBy: string;
  version: number;
  createdAt: Date;
}

const condColumns = {
  id: s.condition.id,
  encounterId: s.condition.encounterId,
  patientId: s.condition.patientId,
  codeSystem: s.condition.codeSystem,
  code: s.condition.code,
  display: s.condition.display,
  category: s.condition.category,
  clinicalStatus: s.condition.clinicalStatus,
  note: s.condition.note,
  recordedBy: s.condition.recordedBy,
  version: s.condition.version,
  createdAt: s.condition.createdAt,
} as const;

export async function insertCondition(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    code: Coding;
    category: "diagnosis" | "problem";
    clinicalStatus: "active" | "resolved";
    note?: string | null;
    recordedBy: string;
  },
): Promise<ConditionRow> {
  const [row] = await db
    .insert(s.condition)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      codeSystem: input.code.system,
      code: input.code.code,
      display: input.code.display,
      category: input.category,
      clinicalStatus: input.clinicalStatus,
      note: input.note ?? null,
      recordedBy: input.recordedBy,
    })
    .returning(condColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listConditionsByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<ConditionRow[]> {
  return db
    .select(condColumns)
    .from(s.condition)
    .where(and(eq(s.condition.encounterId, encounterId), isNull(s.condition.deletedAt)))
    .orderBy(desc(s.condition.createdAt));
}

/* --------------------------- orders + results ---------------------------- */

export interface ServiceRequestRow {
  id: string;
  encounterId: string;
  patientId: string;
  codeSystem: string;
  code: string;
  display: string;
  intent: "order";
  status: "active" | "completed" | "revoked";
  priority: "routine" | "urgent" | "stat";
  note: string | null;
  requesterId: string;
  version: number;
  createdAt: Date;
}

const srColumns = {
  id: s.serviceRequest.id,
  encounterId: s.serviceRequest.encounterId,
  patientId: s.serviceRequest.patientId,
  codeSystem: s.serviceRequest.codeSystem,
  code: s.serviceRequest.code,
  display: s.serviceRequest.display,
  intent: s.serviceRequest.intent,
  status: s.serviceRequest.status,
  priority: s.serviceRequest.priority,
  note: s.serviceRequest.note,
  requesterId: s.serviceRequest.requesterId,
  version: s.serviceRequest.version,
  createdAt: s.serviceRequest.createdAt,
} as const;

export async function insertServiceRequest(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    code: Coding;
    priority: "routine" | "urgent" | "stat";
    note?: string | null;
    requesterId: string;
  },
): Promise<ServiceRequestRow> {
  const [row] = await db
    .insert(s.serviceRequest)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      codeSystem: input.code.system,
      code: input.code.code,
      display: input.code.display,
      priority: input.priority,
      note: input.note ?? null,
      requesterId: input.requesterId,
    })
    .returning(srColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getServiceRequestById(
  db: TenantDb,
  id: string,
): Promise<ServiceRequestRow | undefined> {
  const [row] = await db
    .select(srColumns)
    .from(s.serviceRequest)
    .where(eq(s.serviceRequest.id, id))
    .limit(1);
  return row;
}

export async function listServiceRequestsByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<ServiceRequestRow[]> {
  return db
    .select(srColumns)
    .from(s.serviceRequest)
    .where(and(eq(s.serviceRequest.encounterId, encounterId), isNull(s.serviceRequest.deletedAt)))
    .orderBy(desc(s.serviceRequest.createdAt));
}

export interface DiagnosticReportRow {
  id: string;
  serviceRequestId: string;
  encounterId: string;
  patientId: string;
  status: "preliminary" | "final";
  conclusion: string;
  attachmentId: string | null;
  issuedAt: Date;
  filedBy: string;
  version: number;
  createdAt: Date;
}

const drColumns = {
  id: s.diagnosticReport.id,
  serviceRequestId: s.diagnosticReport.serviceRequestId,
  encounterId: s.diagnosticReport.encounterId,
  patientId: s.diagnosticReport.patientId,
  status: s.diagnosticReport.status,
  conclusion: s.diagnosticReport.conclusion,
  attachmentId: s.diagnosticReport.attachmentId,
  issuedAt: s.diagnosticReport.issuedAt,
  filedBy: s.diagnosticReport.filedBy,
  version: s.diagnosticReport.version,
  createdAt: s.diagnosticReport.createdAt,
} as const;

export async function insertDiagnosticReport(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    serviceRequestId: string;
    encounterId: string;
    patientId: string;
    status: "preliminary" | "final";
    conclusion: string;
    attachmentId?: string | null;
    filedBy: string;
  },
): Promise<DiagnosticReportRow> {
  const [row] = await db
    .insert(s.diagnosticReport)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      serviceRequestId: input.serviceRequestId,
      encounterId: input.encounterId,
      patientId: input.patientId,
      status: input.status,
      conclusion: input.conclusion,
      attachmentId: input.attachmentId ?? null,
      filedBy: input.filedBy,
    })
    .returning(drColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listResultsByEncounter(
  db: TenantDb,
  encounterId: string,
): Promise<DiagnosticReportRow[]> {
  return db
    .select(drColumns)
    .from(s.diagnosticReport)
    .where(
      and(eq(s.diagnosticReport.encounterId, encounterId), isNull(s.diagnosticReport.deletedAt)),
    )
    .orderBy(desc(s.diagnosticReport.createdAt));
}

/* ------------------------------ attachment ------------------------------- */

export interface AttachmentRow {
  id: string;
  encounterId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string | null;
  uploadedAt: Date;
}

const attColumns = {
  id: s.attachment.id,
  encounterId: s.attachment.encounterId,
  objectKey: s.attachment.objectKey,
  contentType: s.attachment.contentType,
  sizeBytes: s.attachment.sizeBytes,
  sha256: s.attachment.sha256,
  uploadedAt: s.attachment.uploadedAt,
} as const;

export async function insertAttachment(
  db: TenantDb,
  input: {
    id: string;
    tenantId: string;
    encounterId: string;
    objectKey: string;
    contentType: string;
    sizeBytes: number;
    sha256?: string | null;
  },
): Promise<AttachmentRow> {
  const [row] = await db
    .insert(s.attachment)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      encounterId: input.encounterId,
      objectKey: input.objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256 ?? null,
    })
    .returning(attColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getAttachmentById(
  db: TenantDb,
  id: string,
): Promise<AttachmentRow | undefined> {
  const [row] = await db
    .select(attColumns)
    .from(s.attachment)
    .where(eq(s.attachment.id, id))
    .limit(1);
  return row;
}
