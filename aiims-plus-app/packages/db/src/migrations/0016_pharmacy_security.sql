-- ============================================================================
-- 0016_pharmacy_security — RLS + grants for the pharmacy module (HAND-WRITTEN,
-- REVIEWED SQL — DDR-0011). Fail-closed (DDR-0002): ENABLE + FORCE + tenant
-- policy; least-privilege grants; soft-delete only where applicable (DDR-0013).
-- Stock and prescription rows are UPDATEd (draw-down, status), so those get
-- UPDATE; line/item/dispense tables are append-only (SELECT + INSERT).
-- ============================================================================

ALTER SCHEMA pharmacy OWNER TO aiims_owner;
GRANT USAGE ON SCHEMA pharmacy TO aiims_app;

ALTER TABLE pharmacy.drug              OWNER TO aiims_owner;
ALTER TABLE pharmacy.stock_batch       OWNER TO aiims_owner;
ALTER TABLE pharmacy.prescription      OWNER TO aiims_owner;
ALTER TABLE pharmacy.prescription_item OWNER TO aiims_owner;
ALTER TABLE pharmacy.dispense          OWNER TO aiims_owner;
ALTER TABLE pharmacy.dispense_item     OWNER TO aiims_owner;

-- drug
ALTER TABLE pharmacy.drug ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.drug FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.drug
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON pharmacy.drug TO aiims_app;

-- stock_batch (draw-down updates quantity)
ALTER TABLE pharmacy.stock_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.stock_batch FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.stock_batch
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON pharmacy.stock_batch TO aiims_app;

-- prescription (status transitions to dispensed/cancelled)
ALTER TABLE pharmacy.prescription ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.prescription FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.prescription
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON pharmacy.prescription TO aiims_app;

-- prescription_item (append-only at write time)
ALTER TABLE pharmacy.prescription_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.prescription_item FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.prescription_item
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON pharmacy.prescription_item TO aiims_app;

-- dispense (append-only)
ALTER TABLE pharmacy.dispense ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.dispense FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.dispense
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON pharmacy.dispense TO aiims_app;

-- dispense_item (append-only)
ALTER TABLE pharmacy.dispense_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy.dispense_item FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON pharmacy.dispense_item
  USING      (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON pharmacy.dispense_item TO aiims_app;
