-- ============================================================================
-- 0018_feedback_security — RLS + grants for patient feedback (HAND-WRITTEN,
-- REVIEWED SQL — DDR-0011). Fail-closed (DDR-0002): ENABLE + FORCE + tenant
-- policy; least-privilege grants. Feedback is append-only: a patient submits
-- once and it is never edited, so aiims_app gets SELECT + INSERT only.
-- ============================================================================

ALTER SCHEMA feedback OWNER TO aiims_owner;
GRANT USAGE ON SCHEMA feedback TO aiims_app;

ALTER TABLE feedback.patient_feedback OWNER TO aiims_owner;

ALTER TABLE feedback.patient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.patient_feedback FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON feedback.patient_feedback
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON feedback.patient_feedback TO aiims_app;
