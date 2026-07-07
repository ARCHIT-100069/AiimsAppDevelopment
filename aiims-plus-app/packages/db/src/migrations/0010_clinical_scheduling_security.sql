-- ============================================================================
-- 0010_clinical_scheduling_security — RLS + grants for Stage 4
-- (HAND-WRITTEN, REVIEWED SQL — DDR-0011). Security-review event; watched by
-- the policy-diff gate and the isolation suite. Same fail-closed pattern as
-- every clinical table (DDR-0002): ENABLE + FORCE + tenant_isolation policy,
-- least-privilege grants, soft-delete only (no DELETE, DDR-0013).
-- ============================================================================

ALTER TABLE clinical.appointment              OWNER TO aiims_owner;
ALTER TABLE clinical.encounter                OWNER TO aiims_owner;
ALTER TABLE clinical.practitioner_availability OWNER TO aiims_owner;
ALTER TABLE clinical.opd_queue_counter        OWNER TO aiims_owner;

-- clinical.appointment
ALTER TABLE clinical.appointment ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.appointment FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.appointment
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.appointment TO aiims_app;

-- clinical.encounter
ALTER TABLE clinical.encounter ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.encounter FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.encounter
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.encounter TO aiims_app;

-- clinical.practitioner_availability
ALTER TABLE clinical.practitioner_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.practitioner_availability FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.practitioner_availability
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.practitioner_availability TO aiims_app;

-- clinical.opd_queue_counter
ALTER TABLE clinical.opd_queue_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical.opd_queue_counter FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON clinical.opd_queue_counter
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON clinical.opd_queue_counter TO aiims_app;
