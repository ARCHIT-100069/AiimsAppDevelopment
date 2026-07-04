import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { loadConfig } from "@aiims/config";
import type { Principal, Role } from "@aiims/authz";

const cfg = loadConfig();
/**
 * Stage 0 dev auth: trusts signed dev headers ONLY when DEV_AUTH=true (never in prod).
 * Production (SDR-0001): validate Keycloak OIDC bearer JWT (iss/aud/exp + JWKS), BFF for web.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (cfg.DEV_AUTH) {
      const tenantId = req.headers["x-dev-tenant"]; const userId = req.headers["x-dev-user"] ?? "dev-user";
      const roles = String(req.headers["x-dev-roles"] ?? "admin").split(",") as Role[];
      if (!tenantId) throw new UnauthorizedException("missing x-dev-tenant (DEV_AUTH)");
      const principal: Principal = { userId, tenantId, roles };
      req.principal = principal; return true;
    }
    // TODO(prod): verify OIDC JWT against cfg.OIDC_ISSUER JWKS, map claims -> Principal.
    throw new UnauthorizedException("OIDC not configured");
  }
}
