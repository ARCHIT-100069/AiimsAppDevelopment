-- ============================================================================
-- 0020_laboratory_security — RLS + grants for lab result lines (HAND-WRITTEN,
-- REVIEWED SQL — DDR-0011). Fail-closed (DDR-0002): ENABLE + FORCE + tenant
-- policy; least-privilege grants. Result lines are append-only (SELECT + INSERT).
-- ============================================================================

ALTER TABLE orders.lab_result_line OWNER TO aiims_owner;

ALTER TABLE orders.lab_result_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders.lab_result_line FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders.lab_result_line
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON orders.lab_result_line TO aiims_app;
