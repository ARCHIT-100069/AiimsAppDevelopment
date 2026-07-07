-- ============================================================================
-- 0012_emr_security — RLS + grants for Stage 5 (HAND-WRITTEN, REVIEWED SQL —
-- DDR-0011). Security-review event; watched by the policy-diff gate and the
-- isolation suite. Same fail-closed pattern as every clinical table (DDR-0002):
-- ENABLE + FORCE + tenant_isolation policy, least-privilege grants, soft-delete
-- only (no DELETE, DDR-0013 — clinical records are retained/amended, not erased).
-- ============================================================================

-- New `orders` schema is owned by aiims_owner; app role gets USAGE only.
ALTER SCHEMA orders OWNER TO aiims_owner;
GRANT USAGE ON SCHEMA orders TO aiims_app;

ALTER TABLE clinical.clinical_note      OWNER TO aiims_owner;
ALTER TABLE clinical.observation        OWNER TO aiims_owner;
ALTER TABLE clinical.condition          OWNER TO aiims_owner;
ALTER TABLE clinical.attachment         OWNER TO aiims_owner;
ALTER TABLE orders.service_request      OWNER TO aiims_owner;
ALTER TABLE orders.diagnostic_report    OWNER TO aiims_owner;

-- clinical.clinical_note
ALTER TABLE clinical.clinical_note ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.clinical_note FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.clinical_note
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
-- Notes are append-only versions (DDR-0013): INSERT + SELECT only, no UPDATE/DELETE.
GRANT SELECT, INSERT ON clinical.clinical_note TO aiims_app;

-- clinical.observation
ALTER TABLE clinical.observation ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.observation FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.observation
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.observation TO aiims_app;

-- clinical.condition
ALTER TABLE clinical.condition ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.condition FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.condition
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.condition TO aiims_app;

-- clinical.attachment
ALTER TABLE clinical.attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.attachment FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.attachment
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON clinical.attachment TO aiims_app;

-- orders.service_request
ALTER TABLE orders.service_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders.service_request FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders.service_request
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON orders.service_request TO aiims_app;

-- orders.diagnostic_report
ALTER TABLE orders.diagnostic_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders.diagnostic_report FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders.diagnostic_report
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON orders.diagnostic_report TO aiims_app;
