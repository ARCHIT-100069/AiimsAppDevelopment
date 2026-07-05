/**
 * Tenant registry endpoints — platform operators only (Stage 1).
 * Controllers expose contracts/DTOs, never database rows (clarification #1).
 */
import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  createTenantRequestSchema,
  listQuerySchema,
  type ListTenantsResponse,
  type TenantResponse,
} from "@aiims/api-contracts";
import type { TenantRow } from "@aiims/db";
import type { PlatformPrincipal } from "@aiims/domain-types";
import { CurrentPlatformAdmin, RequirePermission } from "../../../platform/decorators";
import { TenancyService } from "../application/tenancy.service";

function toResponse(t: TenantRow): TenantResponse {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  } as TenantResponse;
}

@Controller("v1/tenants")
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  /** 201 on create, 200 on idempotent replay (clarification #3). */
  @Post()
  @RequirePermission("platform:tenant:manage")
  async create(
    @CurrentPlatformAdmin() admin: PlatformPrincipal,
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TenantResponse> {
    const request = createTenantRequestSchema.parse(rawBody);
    const { tenant, created } = await this.tenancy.createTenant(admin, request);
    res.status(created ? 201 : 200);
    return toResponse(tenant);
  }

  @Get()
  @RequirePermission("platform:tenant:manage")
  async list(@Query() rawQuery: unknown): Promise<ListTenantsResponse> {
    const { limit } = listQuerySchema.parse(rawQuery);
    const tenants = await this.tenancy.listTenants(limit);
    return { data: tenants.map(toResponse), meta: { nextCursor: null } };
  }
}
