/**
 * AuthN guard (SDR-0001, APDR-0004): verifies the Bearer OIDC access token
 * against the Keycloak realm JWKS (`iss`, `exp`, signature; `aud` when the
 * realm sets it), extracts the tenant claim, then resolves the platform
 * principal: app_user by keycloak_sub + RBAC role codes — both read UNDER the
 * token's own tenant context, so a token forged for another tenant resolves
 * no user (RLS fail-closed) and is rejected.
 */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AppConfig } from "@aiims/config";
import { findActiveUserByKeycloakSub, roleCodesForUser } from "@aiims/db";
import {
  PLATFORM_ADMIN_ROLE,
  type Principal,
  type TenantId,
  type UserId,
} from "@aiims/domain-types";
import type { Request } from "express";
import { UnauthenticatedError } from "../common/errors";
import { CONFIG } from "./config.provider";
import { IS_PUBLIC } from "./decorators";
import { UnitOfWork } from "./db.provider";
import { setPrincipal } from "./request-context";

interface AiimsClaims extends JWTPayload {
  tenant_id?: string;
  realm_access?: { roles?: string[] };
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly reflector: Reflector,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly uow: UnitOfWork,
  ) {
    this.jwks = createRemoteJWKSet(
      new URL(`${config.OIDC_ISSUER_URL}/protocol/openid-connect/certs`),
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthenticatedError("Missing bearer token");
    }

    let claims: AiimsClaims;
    try {
      const { payload } = await jwtVerify<AiimsClaims>(header.slice(7), this.jwks, {
        issuer: this.config.OIDC_ISSUER_URL,
      });
      claims = payload;
    } catch {
      throw new UnauthenticatedError("Invalid or expired token");
    }

    const keycloakSub = claims.sub;
    if (!keycloakSub) {
      throw new UnauthenticatedError("Token lacks a subject");
    }

    // Platform operators (Stage 1): the Keycloak REALM role `platform_admin`
    // authorizes tenant-REGISTRY operations only — no tenant context, no
    // tenant-data permissions (least privilege, SDR-0002).
    if (claims.realm_access?.roles?.includes(PLATFORM_ADMIN_ROLE)) {
      setPrincipal({ kind: "platform", actorId: keycloakSub, roles: [PLATFORM_ADMIN_ROLE] });
      return true;
    }

    const tenantId = claims.tenant_id;
    if (!tenantId) {
      throw new UnauthenticatedError("Token lacks a tenant claim");
    }

    // Resolve the platform identity under the claimed tenant's RLS context.
    const principal = await this.uow.withTenant(
      { tenantId, actorId: keycloakSub },
      async (db): Promise<Principal | undefined> => {
        const user = await findActiveUserByKeycloakSub(db, keycloakSub);
        if (!user) return undefined;
        const roles = await roleCodesForUser(db, user.id);
        return {
          kind: "tenant",
          actorId: user.id as UserId,
          tenantId: tenantId as TenantId,
          roles,
        };
      },
    );
    if (!principal) {
      // Unknown/disabled user for this tenant — fail closed.
      throw new UnauthenticatedError("No active user for this token");
    }

    setPrincipal(principal);
    return true;
  }
}
