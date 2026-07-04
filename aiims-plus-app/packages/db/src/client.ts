import { Pool } from "pg";

/**
 * Application pool factory. The URL MUST authenticate as `aiims_app`
 * (no ownership, no BYPASSRLS — DDR-0003); production equivalents connect
 * through RDS Proxy (IDR-0006).
 */
export function createAppPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}
