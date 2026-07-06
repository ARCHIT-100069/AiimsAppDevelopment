-- ============================================================================
-- 0008_clinical_practitioner_security — RLS + grants for Stage 3
-- (HAND-WRITTEN, REVIEWED SQL — DDR-0011). Security-review event; watched by
-- the policy-diff gate and the isolation suite.
-- ============================================================================

ALTER TABLE clinical.practitioner OWNER TO aiims_owner;

-- RLS: ENABLE + FORCE + fail-closed tenant policy (DDR-0002 pattern).
ALTER TABLE clinical.practitioner ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.practitioner FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.practitioner
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Least privilege; soft-delete only (DDR-0013) ⇒ no DELETE.
GRANT SELECT, INSERT, UPDATE ON clinical.practitioner TO aiims_app;
