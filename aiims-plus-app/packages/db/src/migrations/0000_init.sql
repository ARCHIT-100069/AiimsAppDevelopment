-- ============================================================================
-- 0000_init — Stage 0 platform + audit schemas (hand-written, reviewed SQL).
--
-- Authored by hand (not drizzle-kit) because this migration includes
-- partitioned tables, which drizzle-kit does not manage (DDR-0011). Future
-- pure table/column changes use drizzle-kit generate; security DDL never does.
--
-- Conventions (DATABASE-ARCHITECTURE §4): snake_case, singular tables,
-- timestamptz, UUIDv7 app-generated PKs (DDR-0001), tenant-scoped composite
-- FKs (DDR-0008), tenant-first indexes (§12).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS audit;

-- ----------------------------------------------------------------------------
-- platform.tenant — the isolation root (DB Arch §5). NOT tenant-RLS'd: it is
-- the lookup that resolves tenancy; writes are platform-admin operations.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.tenant (
  id             uuid PRIMARY KEY,
  slug           text NOT NULL UNIQUE,
  name           text NOT NULL,
  status         text NOT NULL DEFAULT 'active'  CHECK (status IN ('active', 'suspended')),
  isolation_mode text NOT NULL DEFAULT 'shared'  CHECK (isolation_mode IN ('shared', 'dedicated')),
  region         text NOT NULL DEFAULT 'ap-south-1',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- platform.app_user — Keycloak subject → tenant user (ADR-0008: Keycloak owns
-- credentials; we store the mapping only).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.app_user (
  id           uuid PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES platform.tenant(id),
  keycloak_sub text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Composite-FK target so children are tenant-scoped (DDR-0008).
  UNIQUE (tenant_id, id)
);
CREATE INDEX ix_app_user__tenant ON platform.app_user (tenant_id);

CREATE TABLE platform.role (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES platform.tenant(id),
  code       text NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  UNIQUE (tenant_id, id)
);

CREATE TABLE platform.user_role (
  tenant_id uuid NOT NULL,
  user_id   uuid NOT NULL,
  role_id   uuid NOT NULL,
  PRIMARY KEY (tenant_id, user_id, role_id),
  -- Tenant-scoped referential integrity: a user_role can never point across
  -- tenants (DDR-0008) — structurally impossible, not merely RLS-hidden.
  FOREIGN KEY (tenant_id, user_id) REFERENCES platform.app_user (tenant_id, id),
  FOREIGN KEY (tenant_id, role_id) REFERENCES platform.role (tenant_id, id)
);

-- NULL tenant_id = global default; per-tenant row overrides (DB Arch §5).
CREATE TABLE platform.feature_flag (
  id         uuid PRIMARY KEY,
  tenant_id  uuid REFERENCES platform.tenant(id),
  key        text NOT NULL,
  enabled    boolean NOT NULL DEFAULT false,
  variant    jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, key)
);

-- ----------------------------------------------------------------------------
-- platform.outbox — transactional outbox (DDR-0007), written in the SAME
-- transaction as the business change. Monthly range partitions from day one
-- (DDR-0010); the PK must include the partition key.
-- ----------------------------------------------------------------------------
CREATE TABLE platform.outbox (
  id                uuid NOT NULL,
  tenant_id         uuid NOT NULL REFERENCES platform.tenant(id),
  aggregate_type    text NOT NULL,
  aggregate_id      uuid NOT NULL,
  event_type        text NOT NULL,
  payload           jsonb NOT NULL,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  dispatched_at     timestamptz,
  dispatch_attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE platform.outbox_2026_07 PARTITION OF platform.outbox
  FOR VALUES FROM ('2026-07-01T00:00:00Z') TO ('2026-08-01T00:00:00Z');
CREATE TABLE platform.outbox_2026_08 PARTITION OF platform.outbox
  FOR VALUES FROM ('2026-08-01T00:00:00Z') TO ('2026-09-01T00:00:00Z');
CREATE TABLE platform.outbox_2026_09 PARTITION OF platform.outbox
  FOR VALUES FROM ('2026-09-01T00:00:00Z') TO ('2026-10-01T00:00:00Z');
-- Safety net until partition automation lands (ODR-0009 capacity task).
CREATE TABLE platform.outbox_default PARTITION OF platform.outbox DEFAULT;

CREATE INDEX ix_outbox__pending ON platform.outbox (occurred_at) WHERE dispatched_at IS NULL;
CREATE INDEX ix_outbox__tenant_occurred ON platform.outbox (tenant_id, occurred_at);

-- ----------------------------------------------------------------------------
-- audit.audit_log — append-only, hash-chained (ADR-0005/DDR-0007).
-- id equals the outbox event id (idempotent projection). The hash chain is
-- per tenant: prev_hash links to the tenant's previous audit row, which is
-- the only chain readable under RLS (fail-closed by construction).
-- NO PHI: context carries request metadata and references only.
-- ----------------------------------------------------------------------------
CREATE TABLE audit.audit_log (
  id            uuid NOT NULL,
  tenant_id     uuid NOT NULL REFERENCES platform.tenant(id),
  actor_id      uuid NOT NULL,
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   uuid NOT NULL,
  occurred_at   timestamptz NOT NULL,
  consent_ref   uuid,
  context       jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash     bytea NOT NULL,
  row_hash      bytea NOT NULL,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE audit.audit_log_2026_07 PARTITION OF audit.audit_log
  FOR VALUES FROM ('2026-07-01T00:00:00Z') TO ('2026-08-01T00:00:00Z');
CREATE TABLE audit.audit_log_2026_08 PARTITION OF audit.audit_log
  FOR VALUES FROM ('2026-08-01T00:00:00Z') TO ('2026-09-01T00:00:00Z');
CREATE TABLE audit.audit_log_2026_09 PARTITION OF audit.audit_log
  FOR VALUES FROM ('2026-09-01T00:00:00Z') TO ('2026-10-01T00:00:00Z');
CREATE TABLE audit.audit_log_default PARTITION OF audit.audit_log DEFAULT;

CREATE INDEX ix_audit_log__tenant_occurred ON audit.audit_log (tenant_id, occurred_at DESC);

-- ----------------------------------------------------------------------------
-- platform.note — Stage 0 walking-skeleton PROOF table (Master Plan §10:
-- "a trivial tenant-scoped write is audited via the outbox"). Not a clinical
-- feature; removed when Stage 1 lands. Carries the standard mixins:
-- base + tenant + soft-delete + optimistic version (DB Arch §4, DDR-0009/0013).
-- ----------------------------------------------------------------------------
CREATE TABLE platform.note (
  id         uuid PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES platform.tenant(id),
  author_id  uuid NOT NULL,
  body       text NOT NULL,
  version    integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  FOREIGN KEY (tenant_id, author_id) REFERENCES platform.app_user (tenant_id, id)
);
CREATE INDEX ix_note__tenant_created ON platform.note (tenant_id, created_at DESC);
