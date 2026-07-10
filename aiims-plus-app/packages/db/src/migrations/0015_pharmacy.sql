-- ============================================================================
-- 0015_pharmacy — Pharmacy module (hand-written, reviewed SQL — DDR-0011).
-- Drug master + batched stock, prescriptions (medication requests) written by a
-- prescriber, and dispensing that draws down stock FEFO. Composite FKs keep
-- everything tenant-scoped (DDR-0008); quantities are integers.
-- ============================================================================

CREATE SCHEMA pharmacy;

-- Drug master (formulary).
CREATE TABLE pharmacy.drug (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  name            text NOT NULL,
  form            text NOT NULL,            -- tablet / capsule / syrup / injection …
  strength        text NOT NULL,            -- e.g. "500 mg"
  unit            text NOT NULL DEFAULT 'unit',
  category        text,
  reorder_level   integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, name, strength, form)
);
CREATE INDEX ix_drug__tenant_name ON pharmacy.drug (tenant_id, name);

-- Batched stock: each receipt is a batch with its own expiry.
CREATE TABLE pharmacy.stock_batch (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  drug_id         uuid NOT NULL,
  batch_no        text NOT NULL,
  expiry_date     date NOT NULL,
  quantity        integer NOT NULL CHECK (quantity >= 0),
  mrp             numeric(12,2) NOT NULL DEFAULT 0 CHECK (mrp >= 0),
  received_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, drug_id) REFERENCES pharmacy.drug (tenant_id, id)
);
-- FEFO draw-down index: earliest expiry, with stock, first.
CREATE INDEX ix_stock_batch__fefo ON pharmacy.stock_batch (tenant_id, drug_id, expiry_date);

-- Prescription (medication request) — OPD prescription may be encounter-less.
CREATE TABLE pharmacy.prescription (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  patient_id      uuid NOT NULL,
  encounter_id    uuid,
  prescriber_id   uuid NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dispensed','cancelled')),
  note            text,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient   (tenant_id, id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id)
);
CREATE INDEX ix_prescription__tenant_status ON pharmacy.prescription (tenant_id, status, created_at DESC);
CREATE INDEX ix_prescription__tenant_patient ON pharmacy.prescription (tenant_id, patient_id, created_at DESC);

CREATE TABLE pharmacy.prescription_item (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  prescription_id uuid NOT NULL,
  drug_id         uuid NOT NULL,
  dose            text NOT NULL,
  frequency       text NOT NULL,
  duration        text NOT NULL,
  quantity        integer NOT NULL CHECK (quantity > 0),
  instructions    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, prescription_id) REFERENCES pharmacy.prescription (tenant_id, id),
  FOREIGN KEY (tenant_id, drug_id)         REFERENCES pharmacy.drug (tenant_id, id)
);
CREATE INDEX ix_prescription_item__presc ON pharmacy.prescription_item (tenant_id, prescription_id);

CREATE TABLE pharmacy.dispense (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  prescription_id uuid NOT NULL,
  patient_id      uuid NOT NULL,
  dispensed_by    uuid NOT NULL,
  dispensed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, prescription_id) REFERENCES pharmacy.prescription (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)      REFERENCES clinical.patient (tenant_id, id)
);
CREATE INDEX ix_dispense__tenant_presc ON pharmacy.dispense (tenant_id, prescription_id);

CREATE TABLE pharmacy.dispense_item (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  dispense_id     uuid NOT NULL,
  drug_id         uuid NOT NULL,
  batch_id        uuid NOT NULL,
  quantity        integer NOT NULL CHECK (quantity > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, dispense_id) REFERENCES pharmacy.dispense (tenant_id, id),
  FOREIGN KEY (tenant_id, batch_id)    REFERENCES pharmacy.stock_batch (tenant_id, id),
  FOREIGN KEY (tenant_id, drug_id)     REFERENCES pharmacy.drug (tenant_id, id)
);
CREATE INDEX ix_dispense_item__dispense ON pharmacy.dispense_item (tenant_id, dispense_id);
