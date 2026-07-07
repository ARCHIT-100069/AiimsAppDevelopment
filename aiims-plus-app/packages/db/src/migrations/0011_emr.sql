-- ============================================================================
-- 0011_emr — Stage 5 (Master Plan §15, DB Arch §8). Hand-written, reviewed SQL
-- (DDR-0011 discipline). The clinical heart: encounter documentation, orders,
-- and results. Constitution-bound — sign is human-only (enforced in the app).
--
-- EXTENDS clinical.encounter (Stage 4 skeleton, D-4.1) — additive only, never a
-- redesign. Adds the sign/finalize lifecycle. Documentation children composite-
-- FK to (tenant_id, encounter_id): notes (append-only versions, DDR-0013),
-- observations (LOINC), conditions (ICD-10/SNOMED). Orders live in a dedicated
-- `orders` schema. Large files are referenced by object key (bytes in S3/MinIO,
-- APDR-0007) — never stored in the DB.
-- ============================================================================

-- ---- extend the encounter skeleton with the documentation lifecycle --------
ALTER TABLE clinical.encounter
  ADD COLUMN chief_complaint text,
  ADD COLUMN signed_at       timestamptz,
  ADD COLUMN signed_by       uuid;
-- signed_by is a practitioner in the same tenant (composite FK, DDR-0008).
ALTER TABLE clinical.encounter
  ADD CONSTRAINT fk_encounter__signed_by
  FOREIGN KEY (tenant_id, signed_by) REFERENCES clinical.practitioner (tenant_id, id);

-- ---- clinical.clinical_note — append-only versioned documentation (DDR-0013)-
-- A logical note = one note_id with 1..N immutable version rows. Amending
-- inserts a new version that supersedes the prior; prior versions are retained.
CREATE TABLE clinical.clinical_note (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES platform.tenant(id),
  encounter_id     uuid NOT NULL,
  note_id          uuid NOT NULL,           -- logical group across versions
  version          integer NOT NULL DEFAULT 1,
  supersedes_id    uuid,                    -- prior version's row id (amendments)
  note_type        text NOT NULL DEFAULT 'progress'
                     CHECK (note_type IN ('progress','consult','discharge')),
  body             text NOT NULL,
  author_id        uuid NOT NULL,           -- practitioner
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','amended')),
  amendment_reason text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  retention_class  text,
  retention_until  timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, note_id, version),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter   (tenant_id, id),
  FOREIGN KEY (tenant_id, author_id)    REFERENCES clinical.practitioner (tenant_id, id)
);
CREATE INDEX ix_note__tenant_encounter ON clinical.clinical_note (tenant_id, encounter_id, created_at DESC);
CREATE INDEX ix_note__tenant_noteid ON clinical.clinical_note (tenant_id, note_id, version DESC);

-- ---- clinical.observation — vitals / measurements (FHIR Observation, LOINC) --
CREATE TABLE clinical.observation (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  encounter_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  code_system     text NOT NULL,
  code            text NOT NULL,
  display         text NOT NULL,
  value_numeric   numeric,
  unit            text,
  value_text      text,
  effective_at    timestamptz NOT NULL DEFAULT now(),
  recorded_by     uuid NOT NULL,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter   (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient      (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by)  REFERENCES clinical.practitioner (tenant_id, id)
);
CREATE INDEX ix_observation__tenant_encounter ON clinical.observation (tenant_id, encounter_id, effective_at DESC);

-- ---- clinical.condition — diagnoses / problems (FHIR Condition) -------------
CREATE TABLE clinical.condition (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  encounter_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  code_system     text NOT NULL,
  code            text NOT NULL,
  display         text NOT NULL,
  category        text NOT NULL DEFAULT 'diagnosis' CHECK (category IN ('diagnosis','problem')),
  clinical_status text NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active','resolved')),
  note            text,
  recorded_by     uuid NOT NULL,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter   (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient      (tenant_id, id),
  FOREIGN KEY (tenant_id, recorded_by)  REFERENCES clinical.practitioner (tenant_id, id)
);
CREATE INDEX ix_condition__tenant_encounter ON clinical.condition (tenant_id, encounter_id, created_at DESC);

-- ---- clinical.attachment — presigned object metadata (APDR-0007) -----------
-- Bytes live in object storage (S3/MinIO); only the tenant-scoped key + hash
-- are recorded here. The API never proxies file bytes.
CREATE TABLE clinical.attachment (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  encounter_id    uuid NOT NULL,
  object_key      text NOT NULL,
  content_type    text NOT NULL,
  size_bytes      bigint NOT NULL,
  sha256          text,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, object_key),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id)
);
CREATE INDEX ix_attachment__tenant_encounter ON clinical.attachment (tenant_id, encounter_id);

-- ---- orders schema — service requests + diagnostic reports -----------------
CREATE SCHEMA orders;

CREATE TABLE orders.service_request (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  encounter_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  code_system     text NOT NULL,
  code            text NOT NULL,
  display         text NOT NULL,
  intent          text NOT NULL DEFAULT 'order' CHECK (intent IN ('order')),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','revoked')),
  priority        text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  note            text,
  requester_id    uuid NOT NULL,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter   (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient      (tenant_id, id),
  FOREIGN KEY (tenant_id, requester_id) REFERENCES clinical.practitioner (tenant_id, id)
);
CREATE INDEX ix_service_request__tenant_encounter ON orders.service_request (tenant_id, encounter_id, created_at DESC);

CREATE TABLE orders.diagnostic_report (
  id                 uuid PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES platform.tenant(id),
  service_request_id uuid NOT NULL,
  encounter_id       uuid NOT NULL,
  patient_id         uuid NOT NULL,
  status             text NOT NULL DEFAULT 'final' CHECK (status IN ('preliminary','final')),
  conclusion         text NOT NULL,
  attachment_id      uuid,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  filed_by           uuid NOT NULL,
  version            integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz,
  retention_class    text,
  retention_until    timestamptz,
  UNIQUE (tenant_id, id),
  -- Orders↔results integrity, tenant-scoped (DDR-0008).
  FOREIGN KEY (tenant_id, service_request_id) REFERENCES orders.service_request (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id)       REFERENCES clinical.encounter     (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)         REFERENCES clinical.patient       (tenant_id, id),
  FOREIGN KEY (tenant_id, attachment_id)      REFERENCES clinical.attachment    (tenant_id, id),
  FOREIGN KEY (tenant_id, filed_by)           REFERENCES clinical.practitioner  (tenant_id, id)
);
CREATE INDEX ix_diagnostic_report__tenant_encounter ON orders.diagnostic_report (tenant_id, encounter_id, created_at DESC);
CREATE INDEX ix_diagnostic_report__tenant_order ON orders.diagnostic_report (tenant_id, service_request_id);
