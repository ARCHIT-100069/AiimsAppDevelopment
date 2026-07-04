/**
 * AuthZ guard — the Policy Enforcement Point (SDR-0002). Every non-public
 * handler must declare @RequirePermission; the decision comes from the
 * @aiims/authz PDP. Denials are logged as security signals (SDR-0010),
 * without PHI.
 */
import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { decide, type Permission } from "@aiims/authz";
import { ForbiddenError } from "../common/errors";
import { IS_PUBLIC, REQUIRED_PERMISSION } from "./decorators";
import { LOGGER, type AppLogger } from "./logger";
import { currentContext, currentPrincipal } from "./request-context";

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(LOGGER) private readonly logger: AppLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) {
      // No opt-outs: an endpoint without a declared permission is a defect.
      throw new ForbiddenError("Endpoint declares no permission — denied by default");
    }

    const principal = currentPrincipal();
    if (!principal) throw new ForbiddenError("No principal");

    const decision = decide({ principal, permission });
    if (!decision.allowed) {
      this.logger.warn(
        {
          securitySignal: "authz_denial",
          correlationId: currentContext().correlationId,
          tenantId: principal.tenantId,
          actorId: principal.actorId,
          permission,
          reason: decision.reason,
        },
        "authorization denied",
      );
      throw new ForbiddenError("Not permitted");
    }
    return true;
  }
}
