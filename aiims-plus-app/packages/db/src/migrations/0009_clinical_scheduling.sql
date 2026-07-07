-- ============================================================================
-- 0009_clinical_scheduling — Stage 4 (Master Plan §14, DB Arch §8).
-- Hand-written, reviewed SQL (DDR-0011 discipline).
--
-- Appointments + the OPD encounter skeleton. Double-booking is prevented at the
-- DATABASE (not the app) by a btree_gist slot-exclusion constraint (DDR-0009):
-- two overlapping ACTIVE appointments for the same practitioner in the same
-- tenant can never both commit. Times are timestamptz (UTC, DB §4); the client
-- renders them in the facility timezone.
--
-- The encounter is a SKELETON (decision D-4.1): check-in opens it; Stage 5 (EMR)
-- EXTENDS it with documentation children and the sign/finalize lifecycle — it
-- never redesigns it. `appointment_id` is nullable so future walk-ins attach
-- without a schema change (decision D-4.8). Every clinical child from Stage 5
-- onward composite-FKs to (tenant_id, encounter id).
-- ============================================================================

-- gist equality on scalar keys (tenant_id, practitioner_id) for the exclusion.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- clinical.appointment → FHIR Appointment (regenerable; DDR-0005 hybrid).
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.appointment (
  id                uuid PRIMARY KEY,
  tenant_id         uuid NOT NULL REFERENCES platform.tenant(id),
  patient_id        uuid NOT NULL,
  practitioner_id   uuid NOT NULL,
  facility_id       uuid NOT NULL,
  department_id     uuid,
  start_at          timestamptz NOT NULL,
  end_at            timestamptz NOT NULL,
  -- Generated half-open interval driving the exclusion constraint.
  slot              tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
  status            text NOT NULL DEFAULT 'booked'
                      CHECK (status IN ('booked','checked_in','in_progress','fulfilled','cancelled','no_show')),
  appointment_type  text NOT NULL DEFAULT 'routine'
                      CHECK (appointment_type IN ('routine','walk_in','follow_up')),
  -- Primary specialty promoted (CodeableConcept hybrid, DDR-0012) + full array.
  specialty_system  text,
  specialty_code    text,
  specialty_display text,
  specialty_codings jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Low-sensitivity booking reason — NOT PHI-encrypted (decision D-4.6);
  -- diagnosis/clinical detail lives in the Stage 5 encounter.
  reason_text       text,
  priority          smallint NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 9),
  -- OPD queue token, issued at check-in (decision D-4.3).
  queue_token       integer,
  checked_in_at     timestamptz,
  cancel_reason     text,
  rescheduled_from_id uuid,
  fhir_id           text,
  fhir_extensions   jsonb NOT NULL DEFAULT '{}'::jsonb,
  version           integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  retention_class   text,
  retention_until   timestamptz,
  CHECK (end_at > start_at),
  UNIQUE (tenant_id, id),                              -- composite-FK target (DDR-0008)
  FOREIGN KEY (tenant_id, patient_id)      REFERENCES clinical.patient      (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_id) REFERENCES clinical.practitioner (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id)     REFERENCES platform.facility     (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id)   REFERENCES platform.department   (tenant_id, id),
  -- THE Stage 4 guarantee: no two overlapping active appointments for a
  -- practitioner within a tenant. Enforced at commit ⇒ concurrency-safe.
  CONSTRAINT ex_appointment__no_double_book EXCLUDE USING gist (
    tenant_id       WITH =,
    practitioner_id WITH =,
    slot            WITH &&
  ) WHERE (status IN ('booked','checked_in','in_progress'))
);

-- Tenant-first access paths (DB Arch §12).
CREATE INDEX ix_appointment__tenant_created ON clinical.appointment (tenant_id, created_at DESC, id DESC);
CREATE INDEX ix_appointment__tenant_practitioner_start ON clinical.appointment (tenant_id, practitioner_id, start_at);
CREATE INDEX ix_appointment__tenant_patient_start ON clinical.appointment (tenant_id, patient_id, start_at DESC);
CREATE INDEX ix_appointment__tenant_dept_start ON clinical.appointment (tenant_id, department_id, start_at);
-- Queue: active appointments by facility/day (partial keeps it small at volume).
CREATE INDEX ix_appointment__queue ON clinical.appointment (tenant_id, facility_id, start_at)
  WHERE status IN ('checked_in','in_progress');

-- ----------------------------------------------------------------------------
-- clinical.encounter → FHIR Encounter (SKELETON; Stage 5 extends). Ambulatory
-- OPD only in MVP. This id is the anchor every EMR/Billing child will FK to.
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.encounter (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  appointment_id  uuid,                          -- nullable: walk-ins (D-4.8)
  patient_id      uuid NOT NULL,
  practitioner_id uuid NOT NULL,
  facility_id     uuid NOT NULL,
  department_id   uuid,
  class           text NOT NULL DEFAULT 'AMB' CHECK (class IN ('AMB')),
  status          text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress','finished','cancelled')),
  period_start    timestamptz NOT NULL DEFAULT now(),
  period_end      timestamptz,
  fhir_id         text,
  fhir_extensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),                              -- composite-FK target (DDR-0008)
  -- One encounter per appointment (check-in is idempotent, APDR-0006).
  UNIQUE (tenant_id, appointment_id),
  FOREIGN KEY (tenant_id, appointment_id)  REFERENCES clinical.appointment  (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)      REFERENCES clinical.patient      (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_id) REFERENCES clinical.practitioner (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id)     REFERENCES platform.facility     (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id)   REFERENCES platform.department   (tenant_id, id)
);

CREATE INDEX ix_encounter__tenant_created ON clinical.encounter (tenant_id, created_at DESC, id DESC);
CREATE INDEX ix_encounter__tenant_patient ON clinical.encounter (tenant_id, patient_id, period_start DESC);

-- ----------------------------------------------------------------------------
-- clinical.practitioner_availability — recurring weekly templates (decision
-- D-4.2). Slots are COMPUTED from these minus active appointments; never
-- materialised. Times are facility-local wall clock.
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.practitioner_availability (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  practitioner_id uuid NOT NULL,
  facility_id     uuid NOT NULL,
  day_of_week     smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  slot_minutes    smallint NOT NULL CHECK (slot_minutes BETWEEN 5 AND 240),
  valid_from      date,
  valid_until     date,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CHECK (end_time > start_time),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, practitioner_id) REFERENCES clinical.practitioner (tenant_id, id),
  FOREIGN KEY (tenant_id, facility_id)     REFERENCES platform.facility     (tenant_id, id)
);

CREATE INDEX ix_availability__tenant_practitioner ON clinical.practitioner_availability
  (tenant_id, practitioner_id, day_of_week);

-- ----------------------------------------------------------------------------
-- clinical.opd_queue_counter — gap-free per (facility, department, day) token
-- issuance (decision D-4.3), mirroring the MRN counter. department_id uses the
-- nil UUID when the appointment has no department, so the composite PK is total.
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.opd_queue_counter (
  tenant_id     uuid NOT NULL REFERENCES platform.tenant(id),
  facility_id   uuid NOT NULL,
  department_id uuid NOT NULL,
  service_date  date NOT NULL,
  last_value    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, facility_id, department_id, service_date)
);
