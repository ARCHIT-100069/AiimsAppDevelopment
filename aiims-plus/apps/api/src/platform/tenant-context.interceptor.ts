import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, Observable } from "rxjs";
import { sql } from "./db.provider.js";
import { als } from "./tenant-context.js";

/** Opens ONE transaction per request and sets SET LOCAL app.tenant_id/actor_id (pool-safe). */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const p = req.principal;
    if (!p) return next.handle(); // unauthenticated routes (e.g. health) skip tenant tx
    const run = sql.begin(async (t) => {
      await t`select set_config('app.tenant_id', ${p.tenantId}, true)`;
      await t`select set_config('app.actor_id', ${p.userId}, true)`;
      return als.run({ tx: t }, () => new Promise((resolve, reject) => {
        next.handle().subscribe({ next: resolve, error: reject });
      }));
    });
    return from(run as Promise<unknown>);
  }
}
