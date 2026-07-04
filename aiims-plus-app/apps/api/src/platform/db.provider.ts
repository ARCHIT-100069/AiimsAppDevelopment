/**
 * DB providers: the aiims_app pool and the Unit-of-Work (BDR-0004).
 * Application services open ONE tenant-scoped transaction per use-case; the
 * business write + outbox event + audit row commit atomically inside it.
 */
import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { AppConfig } from "@aiims/config";
import { createAppPool, withTenantContext, type TenantContext, type TenantDb } from "@aiims/db";
import { CONFIG } from "./config.provider";

/* The Pool type is structural here to avoid importing "pg" in the app
 * (BDR-0003: driver confined to packages/db). */
interface PgPoolLike {
  end(): Promise<void>;
}

export const DB_POOL = Symbol("DB_POOL");

@Injectable()
export class UnitOfWork implements OnApplicationShutdown {
  private readonly pool: ReturnType<typeof createAppPool>;

  constructor(@Inject(CONFIG) config: AppConfig) {
    this.pool = createAppPool(config.DATABASE_URL_APP);
  }

  /** One use-case = one tenant-scoped transaction (BDR-0004, DDR-0002). */
  withTenant<T>(ctx: TenantContext, fn: (db: TenantDb) => Promise<T>): Promise<T> {
    return withTenantContext(this.pool, ctx, fn);
  }

  /** Raw pool — ONLY for non-tenant tables (platform.tenant) and lifecycle. */
  get rawPool(): ReturnType<typeof createAppPool> {
    return this.pool;
  }

  async onApplicationShutdown(): Promise<void> {
    await (this.pool as unknown as PgPoolLike).end();
  }
}
