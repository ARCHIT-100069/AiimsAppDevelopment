/** User + role-assignment endpoints (Stage 1). HTTP-only (BDR-0001). */
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import {
  assignRoleRequestSchema,
  createUserRequestSchema,
  listQuerySchema,
  type ListUsersResponse,
  type UserResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { IdentityService, type UserWithRoles } from "../application/identity.service";

const toUser = (u: UserWithRoles): UserResponse =>
  ({
    id: u.id,
    displayName: u.displayName,
    status: u.status,
    roles: u.roles,
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
