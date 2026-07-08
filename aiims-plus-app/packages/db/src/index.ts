/**
 * @aiims/db — the ONLY package that sees Drizzle or the pg driver
 * (ADR-0011, BDR-0003). Everything else depends on the helpers and the
 * schema's inferred row types; ORM internals do not leave this package.
 */
export * as schema from "./schema";
export { newId } from "./ids";
export { createAppPool } from "./client";
export { withTenantContext, type TenantContext, type TenantDb } from "./tenant-context";
export { migrate } from "./migrate";
export { seed, SEED } from "./seed";
export { checkRlsPolicies } from "./check-rls-policies";
export * from "./audit-hash";
export { verifyAuditChain, verifyAuditIntegrity, type AuditChainRow } from "./verify-audit";
export * from "./queries";
export * from "./platform-queries";
export * from "./patient-queries";
export * from "./practitioner-queries";
export * from "./scheduling-queries";
export * from "./emr-queries";
export * from "./billing-queries";
