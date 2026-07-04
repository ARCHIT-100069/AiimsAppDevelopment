import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Permission } from "@aiims/authz";
import type { Principal } from "@aiims/domain-types";
import { currentPrincipal } from "./request-context";

export const IS_PUBLIC = "aiims:isPublic";
/** Marks an endpoint as unauthenticated — health checks ONLY (APDR-0011). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_PERMISSION = "aiims:requiredPermission";
/** Every non-public handler MUST declare its permission (SDR-0002 PEP). */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): Principal => {
    const principal = currentPrincipal();
    if (!principal) throw new Error("No principal in request context — AuthGuard must run first");
    return principal;
  },
);
