-- ============================================================================
-- 0019_laboratory — Laboratory result lines (hand-written, reviewed SQL —
-- DDR-0011). A diagnostic report (orders.diagnostic_report) carries a free-text
-- conclusion; a real lab report also has structured analyte lines (test, value,
-- unit, reference range, high/low/critical flag). Lines hang off the report and
-- are append-only. Composite FKs keep everything tenant-scoped (DDR-0008).
-- ============================================================================

CREATE TABLE orders.lab_result_line (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES platform.tenant(id),
  report_id       uuid NOT NULL,
  analyte         text NOT NULL,                 -- e.g. "Haemoglobin"
  value           text NOT NULL,                 -- e.g. "13.4" (text: some results are qualitative)
  unit            text,                          -- e.g. "g/dL"
  reference_range text,                          -- e.g. "12.0–15.5"
  flag            text NOT NULL DEFAULT 'normal' CHECK (flag IN ('normal','high','low','critical')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, report_id) REFERENCES orders.diagnostic_report (tenant_id, id)
);
CREATE INDEX ix_lab_result_line__report ON orders.lab_result_line (tenant_id, report_id);
