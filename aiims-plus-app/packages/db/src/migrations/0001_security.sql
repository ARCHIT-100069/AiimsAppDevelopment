-- ============================================================================
-- 0001_security — roles, grants, RLS (HAND-WRITTEN, REVIEWED SQL — DDR-0011).
--
-- drizzle-kit must NEVER manage anything in this file. Any change here
-- requires security review (Master Plan §28) and will be checked by the
-- policy-diff CI gate (check-rls-policies) and the cross-tenant isolation
-- suite (TDR-0006).
--
-- Password placeholders (${...}) are substituted by the migration runner from
-- environment variables; the committed defaults are LOCAL-DEV ONLY. Deployed
-- environments inject real secrets from AWS Secrets Manager (SDR-0006).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Least-privilege role model (DDR-0003).
--    aiims_app: NOSUPERUSER + NOBYPASSRLS + not the table owner ⇒ FORCE RLS
--    always applies to the application — a forgotten WHERE cannot leak PHI.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiims_owner') THEN
    CREATE ROLE aiims_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiims_migrator') THEN
    CREATE ROLE aiims_migrator LOGIN PASSWORD '${AIIMS_MIGRATOR_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiims_app') THEN
    CREATE ROLE aiims_app LOGIN PASSWORD '${AIIMS_APP_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aiims_readonly') THEN
    CREATE ROLE aiims_readonly LOGIN PASSWORD '${AIIMS_READONLY_PASSWORD}'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- The migrator operates with owner rights; objects are owned by aiims_owner
-- (used only by migrations — DDR-0003).
GRANT aiims_owner TO aiims_migrator;

ALTER SCHEMA platform OWNER TO aiims_owner;
ALTER SCHEMA audit OWNER TO aiims_owner;
ALTER TABLE platform.tenant        OWNER TO aiims_owner;
ALTER TABLE platform.app_user      OWNER TO aiims_owner;
ALTER TABLE platform.role          OWNER TO aiims_owner;
ALTER TABLE platform.user_role     OWNER TO aiims_owner;
ALTER TABLE platform.feature_flag  OWNER TO aiims_owner;
ALTER TABLE platform.outbox        OWNER TO aiims_owner;
ALTER TABLE platform.note          OWNER TO aiims_owner;
ALTER TABLE audit.audit_log        OWNER TO aiims_owner;

GRANT CONNECT ON DATABASE ${DATABASE_NAME} TO aiims_app, aiims_readonly;

-- ----------------------------------------------------------------------------
-- 2. Least-privilege grants per schema (DB Arch §14).
--    The app cannot DDL, cannot touch schema_migrations, and can only INSERT
--    into the audit log. Notes are soft-deleted (DDR-0013) ⇒ no DELETE grant.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA platform, audit TO aiims_app, aiims_readonly;

GRANT SELECT ON platform.tenant       TO aiims_app;
GRANT SELECT ON platform.app_user     TO aiims_app;
GRANT SELECT ON platform.role         TO aiims_app;
GRANT SELECT ON platform.user_role    TO aiims_app;
GRANT SELECT ON platform.feature_flag TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON platform.note   TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON platform.outbox TO aiims_app;
GRANT SELECT, INSERT         ON audit.audit_log TO aiims_app;

GRANT SELECT ON ALL TABLES IN SCHEMA platform TO aiims_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA audit    TO aiims_readonly;

-- Append-only audit: even if a broader grant ever slips in, revoke wins the
-- explicit statement war and the isolation/policy gates catch regressions.
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_log FROM aiims_app, aiims_readonly;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security (DDR-0002): ENABLE + FORCE on every tenant-scoped
--    table; fail-closed policies — current_setting(..., true) is NULL when
--    tenant context is unset, so the policy matches zero rows.
-- ----------------------------------------------------------------------------
ALTER TABLE platform.app_user     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.app_user     FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.app_user
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.role         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.role         FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.role
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.user_role    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.user_role    FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.user_role
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Global rows (tenant_id IS NULL) are readable by all tenants; writes are
-- always tenant-bound (DB Arch §5).
ALTER TABLE platform.feature_flag ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.feature_flag FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.feature_flag
  USING      (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.outbox       ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.outbox       FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.outbox
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.note         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.note         FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.note
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE audit.audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.audit_log       FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit.audit_log
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
