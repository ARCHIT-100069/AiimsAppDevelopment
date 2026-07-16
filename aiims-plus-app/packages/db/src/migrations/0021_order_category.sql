-- ============================================================================
-- 0021_order_category — categorise diagnostic orders (hand-written, reviewed SQL
-- — DDR-0011). A service request is a lab test, an imaging study, or another
-- procedure. The category lets the Laboratory and Radiology worklists each show
-- only their own orders. Existing rows default to 'lab' (all demo orders were
-- lab). No RLS change: the column is added to an already-protected table.
-- ============================================================================

ALTER TABLE orders.service_request
  ADD COLUMN category text NOT NULL DEFAULT 'lab'
  CHECK (category IN ('lab', 'imaging', 'other'));

CREATE INDEX ix_service_request__tenant_category
  ON orders.service_request (tenant_id, category, status);
