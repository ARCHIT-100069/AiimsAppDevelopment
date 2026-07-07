/**
 * EMR encounter-documentation endpoints (Stage 5). HTTP-only (BDR-0001):
 * validate via api-contracts, call ONE application service, map row → DTO.
 * Documentation requires an open encounter (409 if signed); sign is doctor-only
 * (Constitution) and enforced by RBAC + a required attestation.
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
} from "@nestjs/common";
import {
  createConditionRequestSchema,
  createNoteRequestSchema,
  createObservationRequestSchema,
  createOrderRequestSchema,
  presignUploadRequestSchema,
  registerAttachmentRequestSchema,
  signEncounterRequestSchema,
  updateEncounterRequestSchema,
  type AttachmentResponse,
  type ConditionResponse,
  type EncounterResponse,
  type ListConditionsResponse,
  type ListNotesResponse,
  type ListObservationsResponse,
  type ListOrdersResponse,
  type ListResultsResponse,
  type NoteResponse,
  type ObservationResponse,
  type OrderResponse,
  type PresignUploadResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { EmrService } from "../application/emr.service";
import {
  toAttachmentResponse,
  toConditionResponse,
  toEncounterResponse,
  toNoteResponse,
  toObservationResponse,
  toOrderResponse,
  toResultResponse,
} from "./emr.mappers";

function requireIfMatch(ifMatch: string | undefined): number {
  const v = Number(ifMatch);
  if (!ifMatch || !Number.isInteger(v) || v < 0) {
    throw new DomainError("If-Match header with the current version is required (APDR-0006)");
  }
  return v;
}

@Controller("v1/encounters")
export class EmrController {
  constructor(private readonly emr: EmrService) {}

  @Patch(":id")
  @RequirePermission("encounter:document")
  async updateChiefComplaint(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<EncounterResponse> {
    const expectedVersion = requireIfMatch(ifMatch);
    const { chiefComplaint } = updateEncounterRequestSchema.parse(rawBody);
    return toEncounterResponse(
      await this.emr.updateChiefComplaint(principal, id, expectedVersion, chiefComplaint),
    );
  }

  /** Constitution: doctor-only, human attestation. Freezes documentation. */
  @Post(":id/sign")
  @HttpCode(200)
  @RequirePermission("encounter:sign")
  async sign(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("if-match") ifMatch: string | undefined,
  ): Promise<EncounterResponse> {
    const expectedVersion = requireIfMatch(ifMatch);
    signEncounterRequestSchema.parse(rawBody);
    return toEncounterResponse(await this.emr.sign(principal, id, expectedVersion));
  }

  @Post(":id/notes")
  @HttpCode(201)
  @RequirePermission("encounter:document")
  async createNote(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<NoteResponse> {
    const req = createNoteRequestSchema.parse(rawBody);
    return toNoteResponse(await this.emr.createNote(principal, id, req));
  }

  @Get(":id/notes")
  @RequirePermission("encounter:read")
  async listNotes(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ListNotesResponse> {
    const rows = await this.emr.listNotes(principal, id);
    return { data: rows.map(toNoteResponse) };
  }

  @Post(":id/observations")
  @HttpCode(201)
  @RequirePermission("encounter:document")
  async recordObservation(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<ObservationResponse> {
    const req = createObservationRequestSchema.parse(rawBody);
    return toObservationResponse(await this.emr.recordObservation(principal, id, req));
  }

  @Get(":id/observations")
  @RequirePermission("encounter:read")
  async listObservations(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ListObservationsResponse> {
    const rows = await this.emr.listObservations(principal, id);
    return { data: rows.map(toObservationResponse) };
  }

  @Post(":id/conditions")
  @HttpCode(201)
  @RequirePermission("encounter:document")
  async recordCondition(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<ConditionResponse> {
    const req = createConditionRequestSchema.parse(rawBody);
    return toConditionResponse(await this.emr.recordCondition(principal, id, req));
  }

  @Get(":id/conditions")
  @RequirePermission("encounter:read")
  async listConditions(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ListConditionsResponse> {
    const rows = await this.emr.listConditions(principal, id);
    return { data: rows.map(toConditionResponse) };
  }

  @Post(":id/orders")
  @HttpCode(201)
  @RequirePermission("order:place")
  async placeOrder(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<OrderResponse> {
    const req = createOrderRequestSchema.parse(rawBody);
    return toOrderResponse(await this.emr.placeOrder(principal, id, req));
  }

  @Get(":id/orders")
  @RequirePermission("encounter:read")
  async listOrders(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ListOrdersResponse> {
    const rows = await this.emr.listOrders(principal, id);
    return { data: rows.map(toOrderResponse) };
  }

  @Get(":id/results")
  @RequirePermission("result:read")
  async listResults(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ListResultsResponse> {
    const rows = await this.emr.listResults(principal, id);
    return { data: rows.map(toResultResponse) };
  }

  @Post(":id/attachments/presign-upload")
  @HttpCode(200)
  @RequirePermission("encounter:document")
  async presignUpload(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<PresignUploadResponse> {
    const req = presignUploadRequestSchema.parse(rawBody);
    const { objectKey, uploadUrl, expiresInSeconds } = await this.emr.presignUpload(
      principal,
      id,
      req,
    );
    return { objectKey, uploadUrl, expiresInSeconds };
  }

  @Post(":id/attachments")
  @HttpCode(201)
  @RequirePermission("encounter:document")
  async registerAttachment(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<AttachmentResponse> {
    const req = registerAttachmentRequestSchema.parse(rawBody);
    return toAttachmentResponse(await this.emr.registerAttachment(principal, id, req));
  }
}
