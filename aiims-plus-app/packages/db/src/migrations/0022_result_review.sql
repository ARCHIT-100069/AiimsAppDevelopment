-- ============================================================================
-- 0022_result_review — a doctor must review a lab/imaging result before it
-- reaches the patient portal (hand-written, reviewed SQL — DDR-0011). Filing
-- a result (lab desk) and releasing it to the patient (the ordering
-- clinician's call) are two different acts of judgment; conflating them let
-- an abnormal finding reach a patient before any doctor had seen it.
-- reviewed_at/reviewed_by start NULL on every existing and new report — the
-- patient-facing query (packages/db/src/me-queries.ts) filters on
-- reviewed_at IS NOT NULL. No RLS change: added to an already-protected table.
-- ============================================================================

ALTER TABLE orders.diagnostic_report
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;

CREATE INDEX ix_diagnostic_report__tenant_reviewed
  ON orders.diagnostic_report (tenant_id, reviewed_at);
