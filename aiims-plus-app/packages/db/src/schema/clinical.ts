/**
 * `clinical` schema (Stage 2) — mirrors the reviewed SQL in ../migrations.
 * Encrypted identifiers are bytea ciphertext + blind-index digests
 * (DDR-0006); Drizzle describes the tables, it never owns security DDL.
 */
import {
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  time,
  timestamp,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";
import { bytea } from "./bytea";

export const clinical = pgSchema("clinical");

export const patient = clinical.table("patient", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  mrn: text("mrn").notNull(),
  nameGiven: text("name_given").notNull(),
  nameFamily: text("name_family").notNull(),
  gender: text("gender").$type<"male" | "female" | "other" | "unknown">().notNull(),
  birthDate: date("birth_date").notNull(),
  abhaAddress: text("abha_address"),
  abhaNumberEnc: bytea("abha_number_enc"),
  abhaNumberBidx: bytea("abha_number_bidx"),
  phoneEnc: bytea("phone_enc"),
  phoneBidx: bytea("phone_bidx"),
  emailEnc: bytea("email_enc"),
  emailBidx: bytea("email_bidx"),
  encKeyRef: text("enc_key_ref"),
  address: jsonb("address"),
  identifiers: jsonb("identifiers").notNull().default({}),
  fhirExtensions: jsonb("fhir_extensions").notNull().default({}),
  fhirId: text("fhir_id"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

export const mrnCounter = clinical.table("mrn_counter", {
  tenantId: uuid("tenant_id").primaryKey(),
  lastValue: bigint("last_value", { mode: "number" }).notNull().default(0),
});

/** Stage 3: clinical profile over an app_user (DB Arch §8). */
export const practitioner = clinical.table("practitioner", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  appUserId: uuid("app_user_id").notNull(),
  nameGiven: text("name_given").notNull(),
  nameFamily: text("name_family").notNull(),
  registrationNo: text("registration_no").notNull(),
  departmentId: uuid("department_id"),
  specialtySystem: text("specialty_system"),
  specialtyCode: text("specialty_code"),
  specialtyDisplay: text("specialty_display"),
  specialtyCodings: jsonb("specialty_codings").notNull().default([]),
  status: text("status").$type<"active" | "inactive">().notNull().default("active"),
  fhirId: text("fhir_id"),
  fhirExtensions: jsonb("fhir_extensions").notNull().default({}),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 4: OPD appointment → FHIR Appointment (DB Arch §8). `slot` is a
 *  generated column enforced by a btree_gist exclusion constraint in SQL. */
export const appointment = clinical.table("appointment", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  practitionerId: uuid("practitioner_id").notNull(),
  facilityId: uuid("facility_id").notNull(),
  departmentId: uuid("department_id"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  status: text("status")
    .$type<"booked" | "checked_in" | "in_progress" | "fulfilled" | "cancelled" | "no_show">()
    .notNull()
    .default("booked"),
  appointmentType: text("appointment_type")
    .$type<"routine" | "walk_in" | "follow_up">()
    .notNull()
    .default("routine"),
  specialtySystem: text("specialty_system"),
  specialtyCode: text("specialty_code"),
  specialtyDisplay: text("specialty_display"),
  specialtyCodings: jsonb("specialty_codings").notNull().default([]),
  reasonText: text("reason_text"),
  priority: smallint("priority").notNull().default(0),
  queueToken: integer("queue_token"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  rescheduledFromId: uuid("rescheduled_from_id"),
  fhirId: text("fhir_id"),
  fhirExtensions: jsonb("fhir_extensions").notNull().default({}),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 4: OPD encounter SKELETON → FHIR Encounter (Stage 5 extends). */
export const encounter = clinical.table("encounter", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  appointmentId: uuid("appointment_id"),
  patientId: uuid("patient_id").notNull(),
  practitionerId: uuid("practitioner_id").notNull(),
  facilityId: uuid("facility_id").notNull(),
  departmentId: uuid("department_id"),
  class: text("class").$type<"AMB">().notNull().default("AMB"),
  status: text("status")
    .$type<"in_progress" | "finished" | "cancelled">()
    .notNull()
    .default("in_progress"),
  chiefComplaint: text("chief_complaint"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  signedBy: uuid("signed_by"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  fhirId: text("fhir_id"),
  fhirExtensions: jsonb("fhir_extensions").notNull().default({}),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 4: recurring weekly availability templates (slots computed, D-4.2). */
export const practitionerAvailability = clinical.table("practitioner_availability", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  practitionerId: uuid("practitioner_id").notNull(),
  facilityId: uuid("facility_id").notNull(),
  dayOfWeek: smallint("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  slotMinutes: smallint("slot_minutes").notNull(),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Stage 4: per (facility, department, day) gap-free OPD token issuance (D-4.3). */
export const opdQueueCounter = clinical.table("opd_queue_counter", {
  tenantId: uuid("tenant_id").notNull(),
  facilityId: uuid("facility_id").notNull(),
  departmentId: uuid("department_id").notNull(),
  serviceDate: date("service_date").notNull(),
  lastValue: integer("last_value").notNull().default(0),
});

/** Stage 5: append-only versioned clinical note (DDR-0013). */
export const clinicalNote = clinical.table("clinical_note", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  noteId: uuid("note_id").notNull(),
  version: integer("version").notNull().default(1),
  supersedesId: uuid("supersedes_id"),
  noteType: text("note_type")
    .$type<"progress" | "consult" | "discharge">()
    .notNull()
    .default("progress"),
  body: text("body").notNull(),
  authorId: uuid("author_id").notNull(),
  status: text("status").$type<"active" | "amended">().notNull().default("active"),
  amendmentReason: text("amendment_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 5: observation / vital (FHIR Observation, LOINC). */
export const observation = clinical.table("observation", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  codeSystem: text("code_system").notNull(),
  code: text("code").notNull(),
  display: text("display").notNull(),
  valueNumeric: numeric("value_numeric"),
  unit: text("unit"),
  valueText: text("value_text"),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
  recordedBy: uuid("recorded_by").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 5: condition / diagnosis (FHIR Condition, ICD-10/SNOMED). */
export const condition = clinical.table("condition", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  patientId: uuid("patient_id").notNull(),
  codeSystem: text("code_system").notNull(),
  code: text("code").notNull(),
  display: text("display").notNull(),
  category: text("category").$type<"diagnosis" | "problem">().notNull().default("diagnosis"),
  clinicalStatus: text("clinical_status")
    .$type<"active" | "resolved">()
    .notNull()
    .default("active"),
  note: text("note"),
  recordedBy: uuid("recorded_by").notNull(),
  version: integer("version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  retentionClass: text("retention_class"),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
});

/** Stage 5: attachment metadata; bytes live in object storage (APDR-0007). */
export const attachment = clinical.table("attachment", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  encounterId: uuid("encounter_id").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
