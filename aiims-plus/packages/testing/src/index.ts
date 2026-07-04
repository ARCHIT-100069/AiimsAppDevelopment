// Shared test utilities. The canonical cross-tenant isolation harness lives in @aiims/db
// (isolation.test.ts) so it runs as aiims_app against real Postgres (TDR-0006).
export const SYNTHETIC_TENANTS = {
  A: "018f0000-0000-7000-8000-00000000000a",
  B: "018f0000-0000-7000-8000-00000000000b",
};
