-- ============================================================================
-- 0017_feedback — Patient feedback & satisfaction (hand-written, reviewed SQL —
-- DDR-0011). NABH/quality accreditation in India requires hospitals to capture
-- and act on patient-satisfaction data. A patient rates their care (1–5), with
-- an optional category + free-text comment, optionally tied to an encounter.
-- Append-only (feedback is never edited after submission); composite FKs keep
-- everything tenant-scoped (DDR-0008).
-- ============================================================================

CREATE SCHEMA feedback;

CREATE TABLE feedback.patient_feedback (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  patient_id      uuid NOT NULL,
  encounter_id    uuid,
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  category        text,                        -- overall / doctor / nursing / cleanliness / billing …
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient   (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id)
);
CREATE INDEX ix_patient_feedback__tenant_created ON feedback.patient_feedback (tenant_id, created_at DESC);
CREATE INDEX ix_patient_feedback__tenant_patient ON feedback.patient_feedback (tenant_id, patient_id, created_at DESC);
