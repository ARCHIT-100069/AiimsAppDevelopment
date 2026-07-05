import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Permission } from "@aiims/authz";
import type { PlatformPrincipal, Principal } from "@aiims/domain-types";
import { ForbiddenError } from "../common/errors";
import { currentPrincipal } from "./request-context";

export const IS_PUBLIC = "aiims:isPublic";
/** Marks an endpoint as unauthenticated — health checks ONLY (APDR-0011). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_PERMISSION = "aiims:requiredPermission";
/** Every non-public handler MUST declare its permission (SDR-0002 PEP). */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

/** Tenant-scoped principal — the normal case. 403 for platform operators. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): Principal => {
    const principal = currentPrincipal();
    if (!principal) throw new Error("No principal in request context — AuthGuard must run first");
    if (principal.kind !== "tenant") {
      // Platform operators hold no tenant-data permissions (least privilege).
      throw new ForbiddenError("Endpoint requires a tenant-scoped principal");
    }
    return principal;
  },
);

/** Platform operator — tenant-registry endpoints only. */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): PlatformPrincipal => {
    const principal = currentPrincipal();
    if (!principal) throw new Error("No principal in request context — AuthGuard must run first");
    if (principal.kind !== "platform") {
      throw new ForbiddenError("Endpoint requires a platform operator");
    }
    return principal;
  },
);
