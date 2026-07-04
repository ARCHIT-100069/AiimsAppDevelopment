import type { Sql } from "postgres";

export interface TenantContext { tenantId: string; actorId?: string; role?: string; }

/**
 * Runs `fn` inside a single transaction with the tenant/actor context set via SET LOCAL
 * (transaction-scoped => safe under connection pooling; DDR 0002). RLS + audit depend on this.
 * Never open a raw, context-less connection for tenant-scoped data.
 */
export async function withTenant<T>(sql: Sql, ctx: TenantContext, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${ctx.tenantId}, true)`;
    if (ctx.actorId) await tx`select set_config('app.actor_id', ${ctx.actorId}, true)`;
    if (ctx.role) await tx`select set_config('app.role', ${ctx.role}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
