-- ============================================================================
-- 0013_billing — Stage 6 (Master Plan §16, DB Arch §8). Hand-written, reviewed
-- SQL (DDR-0011). Invoice an encounter and take (mock) payment — completes the
-- demoable OPD golden path. Money is NUMERIC (never float, DB §4); amounts are
-- computed in the app in integer paise and stored with scale 2.
--
-- One invoice per encounter (UNIQUE), charge-captured from the encounter and its
-- orders. Composite FKs keep everything tenant-scoped (DDR-0008).
-- ============================================================================

CREATE SCHEMA billing;

-- Per-tenant human-usable invoice numbering (gap-free, mirrors the MRN counter).
CREATE TABLE billing.invoice_counter (
  tenant_id  uuid PRIMARY KEY REFERENCES platform.tenant(id),
  last_value bigint NOT NULL DEFAULT 0
);

CREATE TABLE billing.invoice (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  invoice_number  text NOT NULL,
  encounter_id    uuid NOT NULL,
  patient_id      uuid NOT NULL,
  status          text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','cancelled')),
  currency        text NOT NULL DEFAULT 'INR',
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  total           numeric(12,2) NOT NULL DEFAULT 0,
  payment_ref     text,
  payment_method  text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz,
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  retention_class text,
  retention_until timestamptz,
  CHECK (total >= 0 AND subtotal >= 0),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, invoice_number),
  -- One invoice per encounter (duplicate-safe → 409).
  UNIQUE (tenant_id, encounter_id),
  FOREIGN KEY (tenant_id, encounter_id) REFERENCES clinical.encounter (tenant_id, id),
  FOREIGN KEY (tenant_id, patient_id)   REFERENCES clinical.patient   (tenant_id, id)
);
CREATE INDEX ix_invoice__tenant_created ON billing.invoice (tenant_id, created_at DESC, id DESC);
CREATE INDEX ix_invoice__tenant_patient ON billing.invoice (tenant_id, patient_id);

CREATE TABLE billing.invoice_line (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  invoice_id      uuid NOT NULL,
  description     text NOT NULL,
  code_system     text,
  code            text,
  display         text,
  quantity        integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount     numeric(12,2) NOT NULL CHECK (unit_amount >= 0),
  line_amount     numeric(12,2) NOT NULL CHECK (line_amount >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES billing.invoice (tenant_id, id)
);
CREATE INDEX ix_invoice_line__tenant_invoice ON billing.invoice_line (tenant_id, invoice_id);
