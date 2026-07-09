/**
 * Patient portal ("me") — read-only self-service. A patient sees ONLY their own
 * record: the endpoint is scoped to the token's `patientId` AND runs inside the
 * patient's tenant RLS context. Guarded by `self:read`, held solely by the
 * `patient` role. No write path.
 */
import { Controller, Get } from "@nestjs/common";
import {
  getPatientById,
  listDiagnosesByPatient,
  listInvoicesByPatient,
  searchAppointments,
} from "@aiims/db";
import type { MySummaryResponse } from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { UnitOfWork } from "../../../platform/db.provider";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";

@Controller("v1/me")
export class MeController {
  constructor(private readonly uow: UnitOfWork) {}

  @Get("summary")
  @RequirePermission("self:read")
  async summary(@CurrentPrincipal() principal: Principal): Promise<MySummaryResponse> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");

    return this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      async (db): Promise<MySummaryResponse> => {
        const patient = await getPatientById(db, patientId);
        if (!patient) throw new NotFoundError("Patient not found");

        const [appointments, diagnoses, invoices] = await Promise.all([
          searchAppointments(db, { patientId, limit: 20 }),
          listDiagnosesByPatient(db, patientId),
          listInvoicesByPatient(db, patientId),
        ]);

        return {
          profile: {
            id: patient.id,
            mrn: patient.mrn,
            nameGiven: patient.nameGiven,
            nameFamily: patient.nameFamily,
            gender: patient.gender,
            birthDate: patient.birthDate,
            // phone/email stay encrypted at rest; the portal shows the ABHA
            // address (plaintext) and omits the encrypted identifiers.
            phone: null,
            email: null,
            abhaAddress: patient.abhaAddress ?? null,
          },
          appointments: appointments.map((a) => ({
            id: a.id,
            startAt: a.startAt.toISOString(),
            endAt: a.endAt.toISOString(),
            status: a.status,
            appointmentType: a.appointmentType,
            reasonText: a.reasonText ?? null,
          })),
          diagnoses: diagnoses.map((d) => ({
            code: d.code,
            system: d.codeSystem,
            display: d.display,
            category: d.category,
            clinicalStatus: d.clinicalStatus,
            recordedAt: d.recordedAt.toISOString(),
          })),
          invoices: invoices.map((i) => ({
            invoiceNumber: i.invoiceNumber,
            status: i.status,
            currency: i.currency,
            total: i.total,
            paymentMethod: i.paymentMethod ?? null,
            issuedAt: i.issuedAt.toISOString(),
            paidAt: i.paidAt ? i.paidAt.toISOString() : null,
          })),
        };
      },
    );
  }
}
