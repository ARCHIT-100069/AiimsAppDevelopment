-- ============================================================================
-- 0006_clinical_security — RLS + grants for Stage 2 (HAND-WRITTEN, REVIEWED
-- SQL — DDR-0011). Security review required; watched by the policy-diff gate
-- and the isolation suite. First PHI-bearing table: the stakes are real now.
-- ============================================================================

ALTER SCHEMA clinical OWNER TO aiims_owner;
ALTER TABLE clinical.patient          OWNER TO aiims_owner;
ALTER TABLE clinical.mrn_counter      OWNER TO aiims_owner;
ALTER TABLE platform.idempotency_key  OWNER TO aiims_owner;

-- ----------------------------------------------------------------------------
-- 1. RLS: ENABLE + FORCE + fail-closed tenant policies (DDR-0002 pattern).
-- ----------------------------------------------------------------------------
ALTER TABLE clinical.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.patient FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.patient
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE clinical.mrn_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.mrn_counter FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.mrn_counter
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE platform.idempotency_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.idempotency_key FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON platform.idempotency_key
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- ----------------------------------------------------------------------------
-- 2. Grants — least privilege; soft-delete only (DDR-0013) ⇒ no DELETE.
--    aiims_readonly gets NO clinical access in Stage 2: analytics over PHI
--    needs its own review (SDR-0004 minimization).
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA clinical TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON clinical.patient         TO aiims_app;
GRANT SELECT, INSERT, UPDATE ON clinical.mrn_counter     TO aiims_app;
GRANT SELECT, INSERT         ON platform.idempotency_key TO aiims_app;
