-- AIIMS+ Stage 0 — platform + audit schemas, least-privilege roles, RLS (DDR 0002/0003/0007/0011).
-- Hand-written & reviewed (NOT drizzle-kit managed) to prevent silent RLS-policy drops (DDR 0011).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS audit;

-- ---------- Least-privilege role model (DDR 0003) ----------
-- aiims_app: application runtime. NOT owner, NOT superuser, NO BYPASSRLS -> RLS always applies.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aiims_app') THEN
    CREATE ROLE aiims_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- ---------- Tables ----------
CREATE TABLE IF NOT EXISTS platform.tenant (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  isolation_mode text NOT NULL DEFAULT 'shared',
  region text NOT NULL DEFAULT 'ap-south-1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform.note (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
  body text NOT NULL,
  created_by uuid,
  version integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_note__tenant ON platform.note (tenant_id);

CREATE TABLE IF NOT EXISTS platform.outbox (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES platform.tenant(id),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  dispatch_attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_outbox__pending ON platform.outbox (dispatched_at);

CREATE TABLE IF NOT EXISTS platform.feature_flag (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES platform.tenant(id),
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  variant jsonb
);

CREATE TABLE IF NOT EXISTS audit.audit_log (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  consent_ref uuid,
  context jsonb NOT NULL DEFAULT '{}',
  prev_hash bytea,
  row_hash bytea NOT NULL
);

-- ---------- Grants (least privilege; app has no DDL) ----------
GRANT USAGE ON SCHEMA platform, audit TO aiims_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform.tenant, platform.note, platform.outbox, platform.feature_flag TO aiims_app;
-- Audit is INSERT-only for the app (append-only; DDR 0007).
GRANT SELECT, INSERT ON audit.audit_log TO aiims_app;
REVOKE UPDATE, DELETE ON audit.audit_log FROM aiims_app;

-- ---------- Row-Level Security (DDR 0002) ----------
-- Fail-closed: current_setting(...,true) is NULL when unset -> predicate false -> zero rows.
-- FORCE so even the table owner is filtered.
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['platform.note','platform.outbox','platform.feature_flag','audit.audit_log'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %s
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    $p$, t);
  END LOOP;
END $rls$;
-- feature_flag global rows (tenant_id IS NULL) are read via a separate permissive SELECT policy:
CREATE POLICY global_flags_read ON platform.feature_flag FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid);
