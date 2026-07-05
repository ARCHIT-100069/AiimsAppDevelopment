-- ============================================================================
-- 0002_core_platform — Stage 1 tables (Master Plan §11, DB Arch §5/§11).
-- Hand-written, reviewed SQL (partitioning/security conventions of DDR-0011).
--
-- Duplicate-safe creation (founder clarification #3) is anchored HERE:
-- tenant-scoped natural-key UNIQUE constraints make repeated requests unable
-- to create inconsistent data regardless of application behavior.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- platform.organization — a tenant may hold ≥1 org (DB Arch §5).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.organization (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES platform.tenant(id),
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('hospital', 'clinic', 'chain')),
  version    integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (tenant_id, id),   -- composite-FK target (DDR-0008)
  UNIQUE (tenant_id, name)  -- duplicate-safe natural key
);
CREATE INDEX ix_organization__tenant_created ON platform.organization (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- platform.facility — physical site (DB Arch §5).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.facility (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  organization_id uuid NOT NULL,
  name            text NOT NULL,
  address         jsonb,
  timezone        text NOT NULL DEFAULT 'Asia/Kolkata',
  version         integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, organization_id, name),
  -- A facility can never reference another tenant's organization (DDR-0008).
  FOREIGN KEY (tenant_id, organization_id) REFERENCES platform.organization (tenant_id, id)
);
CREATE INDEX ix_facility__tenant_org ON platform.facility (tenant_id, organization_id);
CREATE INDEX ix_facility__tenant_created ON platform.facility (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- platform.department — e.g. OPD-GEN, OPD-CARDIO (DB Arch §5).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.department (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES platform.tenant(id),
  facility_id uuid NOT NULL,
  name        text NOT NULL,
  code        text NOT NULL,
  version     integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, facility_id, code),
  FOREIGN KEY (tenant_id, facility_id) REFERENCES platform.facility (tenant_id, id)
);
CREATE INDEX ix_department__tenant_facility ON platform.department (tenant_id, facility_id);
CREATE INDEX ix_department__tenant_created ON platform.department (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- user_role: department scoping (DB Arch §5 "optionally department-scoped").
-- Expand step (DDR-0011): nullable column + composite FK; no backfill needed.
-- ----------------------------------------------------------------------------
ALTER TABLE platform.user_role ADD COLUMN department_id uuid;
ALTER TABLE platform.user_role
  ADD FOREIGN KEY (tenant_id, department_id) REFERENCES platform.department (tenant_id, id);

-- ----------------------------------------------------------------------------
-- reference schema — GLOBAL code systems (DDR-0012): non-tenant, seeded,
-- read-only to the app role, versioned by release. Seed data is a minimal
-- development set (founder clarification #2), replaced by full imports later
-- by upserting on the same natural keys with a new release marker.
-- ----------------------------------------------------------------------------
CREATE SCHEMA reference;

CREATE TABLE reference.code_system (
  code       text PRIMARY KEY,          -- e.g. 'icd-10', 'loinc', 'snomed'
  name       text NOT NULL,
  uri        text NOT NULL UNIQUE,      -- FHIR system URI (DDR-0012/0005)
  release    text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reference.code (
  system     text NOT NULL REFERENCES reference.code_system(code),
  code       text NOT NULL,
  display    text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (system, code)
);
CREATE INDEX ix_reference_code__system_display ON reference.code (system, display);
