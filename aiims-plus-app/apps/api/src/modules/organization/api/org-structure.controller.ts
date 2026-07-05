/**
 * Directory endpoints (organizations, facilities, departments) — Stage 1.
 * Controllers are HTTP-only (BDR-0001): validate → one service call → DTO.
 */
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import {
  createDepartmentRequestSchema,
  createFacilityRequestSchema,
  createOrganizationRequestSchema,
  listQuerySchema,
  type DepartmentResponse,
  type FacilityResponse,
  type ListDepartmentsResponse,
  type ListFacilitiesResponse,
  type ListOrganizationsResponse,
  type OrganizationResponse,
} from "@aiims/api-contracts";
import type { DepartmentRow, FacilityRow, OrganizationRow } from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { OrgStructureService } from "../application/org-structure.service";

const toOrg = (r: OrganizationRow): OrganizationResponse =>
  ({
    id: r.id,
    name: r.name,
    type: r.type,
    createdAt: r.createdAt.toISOString(),
  }) as OrganizationResponse;

const toFacility = (r: FacilityRow): FacilityResponse =>
  ({
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    timezone: r.timezone,
    createdAt: r.createdAt.toISOString(),
  }) as FacilityResponse;

const toDepartment = (r: DepartmentRow): DepartmentResponse =>
  ({
    id: r.id,
    facilityId: r.facilityId,
    name: r.name,
    code: r.code,
    createdAt: r.createdAt.toISOString(),
  }) as DepartmentResponse;

@Controller("v1")
export class OrgStructureController {
  constructor(private readonly orgs: OrgStructureService) {}

  @Post("organizations")
  @HttpCode(201)
  @RequirePermission("org:manage")
  async createOrganization(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<OrganizationResponse> {
    const req = createOrganizationRequestSchema.parse(rawBody);
    return toOrg(await this.orgs.createOrganization(principal, req));
  }

  @Get("organizations")
  @RequirePermission("org:read")
  async listOrganizations(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListOrganizationsResponse> {
    const { limit, cursor } = listQuerySchema.parse(rawQuery);
    const rows = await this.orgs.listOrganizations(principal, limit, toKeyset(cursor));
    return { data: rows.map(toOrg), meta: { nextCursor: nextCursorFrom(rows, limit) } };
  }

  @Post("facilities")
  @HttpCode(201)
  @RequirePermission("org:manage")
  async createFacility(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<FacilityResponse> {
    const req = createFacilityRequestSchema.parse(rawBody);
    return toFacility(await this.orgs.createFacility(principal, req));
  }

  @Get("facilities")
  @RequirePermission("org:read")
  async listFacilities(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListFacilitiesResponse> {
    const { limit, cursor } = listQuerySchema.parse(rawQuery);
    const rows = await this.orgs.listFacilities(principal, limit, toKeyset(cursor));
    return { data: rows.map(toFacility), meta: { nextCursor: nextCursorFrom(rows, limit) } };
  }

  @Post("departments")
  @HttpCode(201)
  @RequirePermission("org:manage")
  async createDepartment(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<DepartmentResponse> {
    const req = createDepartmentRequestSchema.parse(rawBody);
    return toDepartment(await this.orgs.createDepartment(principal, req));
  }

  @Get("departments")
  @RequirePermission("org:read")
  async listDepartments(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListDepartmentsResponse> {
    const { limit, cursor } = listQuerySchema.parse(rawQuery);
    const rows = await this.orgs.listDepartments(principal, limit, toKeyset(cursor));
    return { data: rows.map(toDepartment), meta: { nextCursor: nextCursorFrom(rows, limit) } };
  }
}
