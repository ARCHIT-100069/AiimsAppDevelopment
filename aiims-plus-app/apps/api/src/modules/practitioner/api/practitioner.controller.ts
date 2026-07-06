/**
 * Practitioner endpoints (Stage 3). HTTP-only (BDR-0001): validate via
 * contracts, call ONE application service, map domain → DTO. Update carries
 * NO appUserId (immutable link).
 */
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
  createPractitionerRequestSchema,
  searchPractitionersQuerySchema,
  updatePractitionerRequestSchema,
  type CreatePractitionerResponse,
  type ListPractitionersResponse,
  type PractitionerResponse,
  type SpecialtyCoding,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import type { Practitioner } from "../domain/practitioner";
import { PractitionerService } from "../application/practitioner.service";

export function toPractitionerResponse(p: Practitioner): PractitionerResponse {
  return {
    id: p.props.id,
    appUserId: p.props.appUserId,
    nameGiven: p.props.nameGiven,
    nameFamily: p.props.nameFamily,
    registrationNo: p.props.registrationNo,
    departmentId: p.props.departmentId,
    specialties: p.props.specialties as SpecialtyCoding[],
    status: p.props.status,
    version: p.props.version,
    createdAt: p.props.createdAt.toISOString(),
  } as PractitionerResponse;
}

@Controller("v1/practitioners")
export class PractitionerController {
  constructor(private readonly practitioners: PractitionerService) {}

  /** 201 with `warnings[]` (may be non-empty per decision i). Duplicate-safe → 409. */
  @Post()
  @HttpCode(201)
  @RequirePermission("practitioner:manage")
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<CreatePractitionerResponse> {
    const request = createPractitionerRequestSchema.parse(rawBody);
    const { practitioner, warnings } = await this.practitioners.create(principal, request);
    return { ...toPractitionerResponse(practitioner), warnings };
  }

  @Get(":id")
  @RequirePermission("practitioner:read")
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PractitionerResponse> {
    return toPractitionerResponse(await this.practitioners.getById(principal, id));
  }

  /** Stale If-Match ⇒ 409 (DDR-0009). appUserId can never be changed here. */
  @Patch(":id")
  @RequirePermission("practitioner:manage")
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<PractitionerResponse> {
    const expectedVersion = Number(ifMatch);
    if (!ifMatch || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new DomainError("If-Match header with the current version is required (APDR-0006)");
    }
    const request = updatePractitionerRequestSchema.parse(rawBody);
    return toPractitionerResponse(
      await this.practitioners.update(principal, id, expectedVersion, request),
    );
  }

  @Get()
  @RequirePermission("practitioner:read")
  async search(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListPractitionersResponse> {
    const query = searchPractitionersQuerySchema.parse(rawQuery);
    const results = await this.practitioners.search(principal, {
      limit: query.limit,
      ...(query.q ? { q: query.q } : {}),
      ...(query.registrationNo ? { registrationNo: query.registrationNo } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(toKeyset(query.cursor) ? { cursor: toKeyset(query.cursor)! } : {}),
    });
    const filtered = Boolean(query.q || query.registrationNo || query.departmentId);
    return {
      data: results.map(toPractitionerResponse),
      meta: {
        nextCursor: filtered
          ? null
          : nextCursorFrom(
              results.map((r) => ({ createdAt: r.props.createdAt, id: r.props.id })),
              query.limit,
            ),
      },
    };
  }
}
