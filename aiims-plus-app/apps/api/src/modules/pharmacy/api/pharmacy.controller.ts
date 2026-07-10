/**
 * Pharmacy endpoints. Formulary + stock (pharmacy:manage/read), prescribing
 * (prescription:write), and dispensing (pharmacy:dispense). Every write is
 * audited and tenant-scoped by the service.
 */
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import {
  addStockRequestSchema,
  createDrugRequestSchema,
  createPrescriptionRequestSchema,
  type DispenseResponse,
  type DrugResponse,
  type ListPrescriptionsResponse,
  type PrescriptionResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { PharmacyService } from "../application/pharmacy.service";

@Controller("v1")
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  @Get("drugs")
  @RequirePermission("pharmacy:read")
  async listDrugs(@CurrentPrincipal() principal: Principal): Promise<{ data: DrugResponse[] }> {
    return { data: await this.pharmacy.listDrugs(principal) };
  }

  @Post("drugs")
  @HttpCode(201)
  @RequirePermission("pharmacy:manage")
  async addDrug(
    @CurrentPrincipal() principal: Principal,
    @Body() raw: unknown,
  ): Promise<DrugResponse> {
    return this.pharmacy.addDrug(principal, createDrugRequestSchema.parse(raw));
  }

  @Post("drugs/:id/stock")
  @HttpCode(201)
  @RequirePermission("pharmacy:manage")
  async addStock(
    @CurrentPrincipal() principal: Principal,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() raw: unknown,
  ): Promise<DrugResponse> {
    return this.pharmacy.addStock(principal, id, addStockRequestSchema.parse(raw));
  }

  @Get("prescriptions")
  @RequirePermission("prescription:read")
  async listPrescriptions(
    @CurrentPrincipal() principal: Principal,
    @Query("status") status?: string,
  ): Promise<ListPrescriptionsResponse> {
    const s =
      status === "active" || status === "dispensed" || status === "cancelled" ? status : undefined;
    return { data: await this.pharmacy.listPrescriptions(principal, s) };
  }

  @Post("prescriptions")
  @HttpCode(201)
  @RequirePermission("prescription:write")
  async write(
    @CurrentPrincipal() principal: Principal,
    @Body() raw: unknown,
  ): Promise<PrescriptionResponse> {
    return this.pharmacy.writePrescription(principal, createPrescriptionRequestSchema.parse(raw));
  }

  @Post("prescriptions/:id/dispense")
  @HttpCode(200)
  @RequirePermission("pharmacy:dispense")
  async dispense(
    @CurrentPrincipal() principal: Principal,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<DispenseResponse> {
    return this.pharmacy.dispense(principal, id);
  }
}
