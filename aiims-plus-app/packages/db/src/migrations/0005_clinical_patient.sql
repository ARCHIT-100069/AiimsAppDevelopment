-- ============================================================================
-- 0005_clinical_patient — Stage 2: the first clinical entity (Master Plan §12,
-- DATABASE-ARCHITECTURE §8). Hand-written, reviewed SQL (DDR-0011 discipline).
--
-- Encrypted identifier pattern (DDR-0006, ratified by SDR-0004):
--   <field>_enc bytea   — AES-256-GCM ciphertext (per-record data key)
--   <field>_bidx bytea  — tenant-salted HMAC blind index for exact lookup
--   enc_key_ref text    — wrapped data key; destroying it = crypto-shred (ADR-0009)
-- All other columns stay queryable under at-rest encryption + RLS.
-- ============================================================================

CREATE SCHEMA clinical;

-- Trigram search for fuzzy name/MRN lookup (Blueprint §17: Postgres FTS in MVP).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- clinical.patient → FHIR Patient (regenerable; DDR-0005 hybrid modeling).
-- Mixins per DB Arch §4: base + tenant + soft-delete/retention + fhir + crypto.
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.patient (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES platform.tenant(id),
  mrn              text NOT NULL,
  name_given       text NOT NULL,
  name_family      text NOT NULL,
  gender           text NOT NULL CHECK (gender IN ('male', 'female', 'other', 'unknown')),
  birth_date       date NOT NULL,
  -- ABHA (ADR-0006 M1; mock-populated in MVP). Address is a routable handle,
  -- kept queryable; the NUMBER is a direct identifier → encrypted.
  abha_address     text,
  abha_number_enc  bytea,
  abha_number_bidx bytea,
  phone_enc        bytea,
  phone_bidx       bytea,
  email_enc        bytea,
  email_bidx       bytea,
  enc_key_ref      text,
  address          jsonb,
  identifiers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  fhir_extensions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  fhir_id          text,
  version          integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  retention_class  text,
  retention_until  timestamptz,
  UNIQUE (tenant_id, mrn),  -- uq_patient__tenant_mrn (DB Arch §8)
  UNIQUE (tenant_id, id)    -- composite-FK target for future children (DDR-0008)
);

-- Tenant-first indexes (DB Arch §12).
CREATE INDEX ix_patient__tenant_created ON clinical.patient (tenant_id, created_at DESC, id DESC);
CREATE INDEX ix_patient__tenant_mrn ON clinical.patient (tenant_id, mrn text_pattern_ops);
CREATE INDEX ix_patient__name_trgm ON clinical.patient
  USING gin ((name_given || ' ' || name_family) gin_trgm_ops);
-- Blind-index lookups (exact match on encrypted identifiers, DDR-0006).
CREATE INDEX ix_patient__tenant_phone_bidx ON clinical.patient (tenant_id, phone_bidx)
  WHERE phone_bidx IS NOT NULL;
CREATE INDEX ix_patient__tenant_email_bidx ON clinical.patient (tenant_id, email_bidx)
  WHERE email_bidx IS NOT NULL;
CREATE INDEX ix_patient__tenant_abha_bidx ON clinical.patient (tenant_id, abha_number_bidx)
  WHERE abha_number_bidx IS NOT NULL;

-- ----------------------------------------------------------------------------
-- clinical.mrn_counter — per-tenant human-usable MRN issuance (decision S2-c:
-- MRN-%06d). Single-row atomic upsert; no gaps guaranteed, no locks needed.
-- ----------------------------------------------------------------------------
CREATE TABLE clinical.mrn_counter (
  tenant_id  uuid PRIMARY KEY REFERENCES platform.tenant(id),
  last_value bigint NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- platform.idempotency_key — APDR-0006: Idempotency-Key required on unsafe
-- POSTs (create patient). Replay returns the original resource. Written in
-- the SAME transaction as the resource it protects (decision S2-e).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.idempotency_key (
  tenant_id   uuid NOT NULL REFERENCES platform.tenant(id),
  endpoint    text NOT NULL,
  key         text NOT NULL,
  resource_id uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, endpoint, key)
);
