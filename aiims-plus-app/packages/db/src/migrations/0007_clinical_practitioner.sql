-- ============================================================================
-- 0007_clinical_practitioner — Stage 3 (Master Plan §13, DB Arch §8).
-- Hand-written, reviewed SQL (DDR-0011 discipline).
--
-- A practitioner is the CLINICAL PROFILE over an existing app_user (decision a):
-- registration number (a professional credential — NOT patient PHI, so not
-- encrypted, decision d), department, and specialty codings. The link to the
-- login (app_user_id) is IMMUTABLE after creation (enforced in the app layer +
-- guarded by the one-profile-per-user unique).
-- ============================================================================

CREATE TABLE clinical.practitioner (
  id               uuid PRIMARY KEY,
  tenant_id        uuid NOT NULL REFERENCES platform.tenant(id),
  app_user_id      uuid NOT NULL,
  name_given       text NOT NULL,
  name_family      text NOT NULL,
  registration_no  text NOT NULL,
  department_id    uuid,
  -- Primary specialty promoted (CodeableConcept hybrid, DDR-0012) + full array.
  specialty_system  text,
  specialty_code    text,
  specialty_display text,
  specialty_codings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  fhir_id          text,
  fhir_extensions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  version          integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  retention_class  text,
  retention_until  timestamptz,
  UNIQUE (tenant_id, id),                 -- composite-FK target (DDR-0008)
  UNIQUE (tenant_id, app_user_id),        -- one clinical profile per login (decision a)
  UNIQUE (tenant_id, registration_no),    -- duplicate-safe natural key (decision g → 409)
  -- Tenant-scoped composite FKs: a practitioner can never link across tenants.
  FOREIGN KEY (tenant_id, app_user_id) REFERENCES platform.app_user (tenant_id, id),
  FOREIGN KEY (tenant_id, department_id) REFERENCES platform.department (tenant_id, id)
);

CREATE INDEX ix_practitioner__tenant_created ON clinical.practitioner (tenant_id, created_at DESC, id DESC);
CREATE INDEX ix_practitioner__tenant_dept ON clinical.practitioner (tenant_id, department_id);
CREATE INDEX ix_practitioner__tenant_reg ON clinical.practitioner (tenant_id, registration_no);
CREATE INDEX ix_practitioner__name_trgm ON clinical.practitioner
  USING gin ((name_given || ' ' || name_family) gin_trgm_ops);
