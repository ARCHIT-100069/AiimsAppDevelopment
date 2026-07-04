/**
 * Transaction-scoped tenant context (DDR-0002).
 *
 * Every data access runs inside a transaction that has set
 * `app.tenant_id` / `app.actor_id` via set_config(..., is_local => true) —
 * the parameterizable equivalent of SET LOCAL, so it is safe under
 * RDS Proxy / transaction pooling and can never bleed across pooled
 * connections. If the context is missing, RLS fails CLOSED (zero rows).
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";

export interface TenantContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly role?: string;
}

export type TenantDb = NodePgDatabase<typeof schema>;

/**
 * Unit-of-work helper (BDR-0004): one use-case = one transaction = one tenant.
 * The business write, its outbox event, and any audit insert commit atomically
 * inside `fn`; on error everything rolls back.
 */
export async function withTenantContext<T>(
  pool: Pool,
  ctx: TenantContext,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.tenant_id', $1, true), set_config('app.actor_id', $2, true)",
      [ctx.tenantId, ctx.actorId],
    );
    if (ctx.role) {
      await client.query("SELECT set_config('app.role', $1, true)", [ctx.role]);
    }
    const db = drizzle(client, { schema });
    const result = await fn(db);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
