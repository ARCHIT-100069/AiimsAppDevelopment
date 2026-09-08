/** User + role-assignment endpoints (Stage 1). HTTP-only (BDR-0001). */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  assignRoleRequestSchema,
  createUserRequestSchema,
  listQuerySchema,
  updateUserStatusRequestSchema,
  type ListUsersResponse,
  type UserResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { IdentityService, type UserWithRoles } from "../application/identity.service";

const toUser = (u: UserWithRoles): UserResponse =>
  ({
    id: u.id,
    displayName: u.displayName,
    status: u.status,
    roles: u.roles,
    version: u.version,
    createdAt: u.createdAt.toISOString(),
  }) as UserResponse;

@Controller("v1/users")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post()
  @HttpCode(201)
  @RequirePermission("user:manage")
  async createUser(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<UserResponse> {
    const req = createUserRequestSchema.parse(rawBody);
    return toUser(await this.identity.createUser(principal, req));
  }

  /** Idempotent: re-assigning an existing role is a no-op 200 (clarification #3). */
  @Post(":id/roles")
  @HttpCode(200)
  @RequirePermission("user:manage")
  async assignRole(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) userId: string,
    @Body() rawBody: unknown,
  ): Promise<{ assigned: true }> {
    const req = assignRoleRequestSchema.parse(rawBody);
    await this.identity.assignRole(principal, userId, req);
    return { assigned: true };
  }

  /** Deactivate/reactivate a staff login. Stale If-Match ⇒ 409 (APDR-0006). */
  @Patch(":id/status")
  @HttpCode(200)
  @RequirePermission("user:manage")
  async updateStatus(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<UserResponse> {
    const expectedVersion = Number(ifMatch);
    if (!ifMatch || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new DomainError("If-Match header with the current version is required (APDR-0006)");
    }
    const { status } = updateUserStatusRequestSchema.parse(rawBody);
    return toUser(await this.identity.updateStatus(principal, id, expectedVersion, status));
  }

  @Get()
  @RequirePermission("user:read")
  async listUsers(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListUsersResponse> {
    const { limit, cursor } = listQuerySchema.parse(rawQuery);
    const users = await this.identity.listUsers(principal, limit, toKeyset(cursor));
    return { data: users.map(toUser), meta: { nextCursor: nextCursorFrom(users, limit) } };
  }
}
