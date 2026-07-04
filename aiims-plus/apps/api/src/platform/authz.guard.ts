import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { can } from "@aiims/authz";
export const RequirePerm = (resource: string, action: string) => SetMetadata("perm", { resource, action });

@Injectable()
export class AuthzGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const meta = this.reflector.get<{ resource: string; action: string }>("perm", ctx.getHandler());
    if (!meta) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.principal || !can(req.principal, meta)) throw new ForbiddenException("not permitted");
    return true;
  }
}
