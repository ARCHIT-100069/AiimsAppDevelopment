/**
 * Billing endpoints (Stage 6). HTTP-only (BDR-0001): validate via api-contracts,
 * call ONE application service, map row → DTO. Invoice generation is duplicate-
 * safe (one per encounter → 409); payment is idempotent (APDR-0006); share is
 * consent-gated (mock ABDM).
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  generateInvoiceRequestSchema,
  payInvoiceRequestSchema,
  shareEncounterRequestSchema,
  type InvoiceLine,
  type InvoiceListItem,
  type InvoiceResponse,
  type ShareEncounterResponse,
} from "@aiims/api-contracts";
import type { InvoiceLineRow, InvoiceRow } from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { DomainError } from "../../../common/errors";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { BillingService } from "../application/billing.service";

function toInvoiceResponse(invoice: InvoiceRow, lines: InvoiceLineRow[]): InvoiceResponse {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    encounterId: invoice.encounterId,
    patientId: invoice.patientId,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    total: invoice.total,
    paymentRef: invoice.paymentRef,
    lines: lines.map(toLine),
    issuedAt: invoice.issuedAt.toISOString(),
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    version: invoice.version,
    createdAt: invoice.createdAt.toISOString(),
  };
}

function toLine(l: InvoiceLineRow): InvoiceLine {
  return {
    id: l.id,
    description: l.description,
    code:
      l.code && l.codeSystem && l.display
        ? { system: l.codeSystem, code: l.code, display: l.display }
        : null,
    quantity: l.quantity,
    unitAmount: l.unitAmount,
    lineAmount: l.lineAmount,
  };
}

function requireIdempotencyKey(key: string | undefined): string {
  if (!key || key.length < 8 || key.length > 128) {
    throw new DomainError("Idempotency-Key header is required (8–128 chars) — APDR-0006");
  }
  return key;
}

@Controller("v1")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post("encounters/:id/invoice")
  @HttpCode(201)
  @RequirePermission("billing:manage")
  async generate(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<InvoiceResponse> {
    const req = generateInvoiceRequestSchema.parse(rawBody ?? {});
    const { invoice, lines } = await this.billing.generate(principal, id, req);
    return toInvoiceResponse(invoice, lines);
  }

  @Get("encounters/:id/invoice")
  @RequirePermission("billing:read")
  async getByEncounter(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<InvoiceResponse> {
    const { invoice, lines } = await this.billing.getByEncounter(principal, id);
    return toInvoiceResponse(invoice, lines);
  }

  @Get("invoices")
  @RequirePermission("billing:read")
  async list(
    @CurrentPrincipal() principal: Principal,
    @Query("status") status?: string,
  ): Promise<{ data: InvoiceListItem[] }> {
    const st =
      status === "issued" || status === "paid" || status === "cancelled" ? status : undefined;
    const rows = await this.billing.list(principal, st);
    return {
      data: rows.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        patientId: r.patientId,
        patientName: r.patientName,
        status: r.status,
        currency: r.currency,
        total: r.total,
        paymentMethod: r.paymentMethod,
        issuedAt: r.issuedAt.toISOString(),
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      })),
    };
  }

  @Get("invoices/:id")
  @RequirePermission("billing:read")
  async getById(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<InvoiceResponse> {
    const { invoice, lines } = await this.billing.getById(principal, id);
    return toInvoiceResponse(invoice, lines);
  }

  @Post("invoices/:id/pay")
  @HttpCode(200)
  @RequirePermission("billing:manage")
  async pay(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<InvoiceResponse> {
    const key = requireIdempotencyKey(idempotencyKey);
    const req = payInvoiceRequestSchema.parse(rawBody ?? {});
    const { invoice, lines } = await this.billing.pay(principal, id, req, key);
    return toInvoiceResponse(invoice, lines);
  }

  @Post("encounters/:id/share")
  @HttpCode(200)
  @RequirePermission("encounter:share")
  async share(
    @CurrentPrincipal() principal: Principal,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() rawBody: unknown,
  ): Promise<ShareEncounterResponse> {
    const req = shareEncounterRequestSchema.parse(rawBody ?? {});
    return this.billing.share(principal, id, req);
  }
}
