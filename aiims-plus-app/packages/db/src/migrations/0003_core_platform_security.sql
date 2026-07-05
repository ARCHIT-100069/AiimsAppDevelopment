-- ============================================================================
-- 0003_core_platform_security — RLS + grants for Stage 1 (HAND-WRITTEN,
-- REVIEWED SQL — DDR-0011). Changes here require security review and are
-- watched by the policy-diff gate + isolation suite.
-- ============================================================================

ALTER TABLE platform.organization OWNER TO aiims_owner;
ALTER TABLE platform.facility     OWNER TO aiims_owner;
ALTER TABLE platform.department   OWNER TO aiims_owner;
ALTER SCHEMA reference OWNER TO aiims_owner;
ALTER TABLE reference.code_system OWNER TO aiims_owner;
ALTER TABLE reference.code        OWNER TO aiims_owner;

-- ----------------------------------------------------------------------------
-- 1. RLS: ENABLE + FORCE + fail-closed tenant policies (DDR-0002 pattern,
--    NULLIF guard for the empty-string GUC on reused pooled sessions).
-- ----------------------------------------------------------------------------
ALTER TABLE platform.organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.organization FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.organization
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.facility     ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.facility     FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.facility
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.department   ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.department   FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.department
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- reference.* is deliberately NOT tenant-RLS'd: global, read-only (DDR-0012).

-- ----------------------------------------------------------------------------
-- 2. Grants (least privilege; soft-delete only ⇒ no DELETE anywhere).
--    Stage 1 opens the app's write path for platform administration:
--    tenant registry writes are PEP-gated to the platform_admin realm role
--    and audited; role/app_user/user_role writes serve tenant admin flows.
-- ----------------------------------------------------------------------------
GRANT INSERT, UPDATE ON platform.tenant TO aiims_app;
GRANT INSERT, UPDATE ON platform.role TO aiims_app;
GRANT INSERT, UPDATE ON platform.app_user TO aiims_app;
GRANT INSERT, UPDATE ON platform.user_role TO aiims_app;

GRANT SELECT, INSERT, UPDATE ON platform.organization TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON platform.facility     TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON platform.department   TO aiims_app;

GRANT USAGE ON SCHEMA reference TO aiims_app, aiims_readonly;
GRANT SELECT ON reference.code_system, reference.code TO aiims_app, aiims_readonly;

GRANT SELECT ON platform.organization, platform.facility, platform.department TO aiims_readonly;
