/**
 * Patient endpoints (Stage 2). HTTP-only (BDR-0001): validate via
 * api-contracts, call ONE application service, map domain → DTO.
 * Identifiers are returned decrypted to authorized principals only.
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
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import {
  createPatientRequestSchema,
  searchPatientsQuerySchema,
  updatePatientRequestSchema,
  type ListPatientsResponse,
  type MySummaryResponse,
  type PatientResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { nextCursorFrom, toKeyset } from "../../../common/cursor";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { PatientService } from "../application/patient.service";
import type { Patient } from "../domain/patient";

export function toPatientResponse(p: Patient): PatientResponse {
  return {
    id: p.props.id,
    mrn: p.props.mrn,
    nameGiven: p.props.nameGiven,
    nameFamily: p.props.nameFamily,
    gender: p.props.gender,
    birthDate: p.props.birthDate,
    phone: p.props.phone,
    email: p.props.email,
    abhaAddress: p.props.abhaAddress,
    abhaNumber: p.props.abhaNumber,
    address: p.props.address,
    version: p.props.version,
    createdAt: p.props.createdAt.toISOString(),
  } as PatientResponse;
}

@Controller("v1/patients")
export class PatientController {
  constructor(private readonly patients: PatientService) {}

  /** Idempotency-Key REQUIRED (APDR-0006: unsafe POST creating clinical data). */
  @Post()
  @RequirePermission("patient:create")
  async register(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PatientResponse> {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new DomainError("Idempotency-Key header is required (8–128 chars) — APDR-0006");
    }
    const request = createPatientRequestSchema.parse(rawBody);
    const { patient, created } = await this.patients.register(principal, request, idempotencyKey);
    res.status(created ? 201 : 200);
    return toPatientResponse(patient);
  }

  @Get(":id")
  @RequirePermission("patient:read")
  async get(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PatientResponse> {
    return toPatientResponse(await this.patients.getById(principal, id));
  }

  /** The clinical chart: visits, vitals, diagnoses, medications, lab/imaging
   *  reports, invoices — one aggregate for the patient workspace. Same shape
   *  the patient's own portal reads for themselves (self:read); here it's
   *  patient:read against an explicit id, for authorized staff. */
  @Get(":id/chart")
  @RequirePermission("patient:read")
  async chart(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<MySummaryResponse> {
    return this.patients.getChart(principal, id);
  }

  /** Stale If-Match ⇒ 409 with reconcile guidance (DDR-0009/APDR-0006). */
  @Patch(":id")
  @RequirePermission("patient:update")
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<PatientResponse> {
    const expectedVersion = Number(ifMatch);
    if (!ifMatch || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new DomainError("If-Match header with the current version is required (APDR-0006)");
    }
    const request = updatePatientRequestSchema.parse(rawBody);
    return toPatientResponse(await this.patients.update(principal, id, expectedVersion, request));
  }

  @Get()
  @RequirePermission("patient:read")
  @HttpCode(200)
  async search(
    @CurrentPrincipal() principal: Principal,
    @Query() rawQuery: unknown,
  ): Promise<ListPatientsResponse> {
    const query = searchPatientsQuerySchema.parse(rawQuery);
    const identifier = query.phone
      ? ({ kind: "phone", value: query.phone } as const)
      : query.abha
        ? ({ kind: "abha", value: query.abha } as const)
        : undefined;
    const results = await this.patients.search(principal, {
      limit: query.limit,
      ...(query.q ? { q: query.q } : {}),
      ...(query.mrn ? { mrn: query.mrn } : {}),
      ...(identifier ? { identifier } : {}),
      ...(toKeyset(query.cursor) ? { cursor: toKeyset(query.cursor)! } : {}),
    });
    const data = results.map(toPatientResponse);
    return {
      data,
      meta: {
        nextCursor:
          query.q || query.mrn || identifier
            ? null // filtered lookups are bounded; cursors apply to plain listing
            : nextCursorFrom(
                results.map((r) => ({ createdAt: r.props.createdAt, id: r.props.id })),
                query.limit,
              ),
      },
    };
  }
}
