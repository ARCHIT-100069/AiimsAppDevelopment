-- ============================================================================
-- 0014_billing_security — RLS + grants for Stage 6 (HAND-WRITTEN, REVIEWED SQL
-- — DDR-0011). Security-review event; watched by the policy-diff gate and the
-- isolation suite. Fail-closed pattern (DDR-0002): ENABLE + FORCE + tenant
-- policy, least-privilege grants, soft-delete only (no DELETE, DDR-0013).
-- ============================================================================

ALTER SCHEMA billing OWNER TO aiims_owner;
GRANT USAGE ON SCHEMA billing TO aiims_app;

ALTER TABLE billing.invoice_counter OWNER TO aiims_owner;
ALTER TABLE billing.invoice         OWNER TO aiims_owner;
ALTER TABLE billing.invoice_line    OWNER TO aiims_owner;

-- billing.invoice_counter
ALTER TABLE billing.invoice_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice_counter FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing.invoice_counter
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON billing.invoice_counter TO aiims_app;

-- billing.invoice
ALTER TABLE billing.invoice ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing.invoice
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON billing.invoice TO aiims_app;

-- billing.invoice_line (append-only at issue time: INSERT + SELECT)
ALTER TABLE billing.invoice_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice_line FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON billing.invoice_line
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON billing.invoice_line TO aiims_app;
