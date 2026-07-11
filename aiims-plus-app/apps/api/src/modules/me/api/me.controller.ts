/**
 * Patient portal ("me") — self-service. A patient sees and acts on ONLY their
 * own record: every endpoint is scoped to the token's `patientId` AND runs
 * inside the patient's tenant RLS context. Reads need `self:read`; booking
 * needs `self:book`. Booking (MeService) writes an appointment + outbox event +
 * audit in one transaction, forcing the patient id from the token — never the
 * request body.
 */
import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import {
  computeFreeSlots,
  getPatientById,
  listBookablePractitioners,
  listDiagnosesByPatient,
  listInvoicesByPatient,
  listPrescriptionItems,
  listPrescriptionsByPatient,
  listReportsByPatient,
  listVisitsByPatient,
  listVitalsByPatient,
  searchAppointments,
} from "@aiims/db";
import {
  bookMyAppointmentRequestSchema,
  type BookableOptionsResponse,
  type MyAppointment,
  type MySummaryResponse,
  type SlotsResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { UnitOfWork } from "../../../platform/db.provider";
import { CurrentPrincipal, RequirePermission } from "../../../platform/decorators";
import { MeService } from "../application/me.service";

const VISIT_MINUTES = 15;

@Controller("v1/me")
export class MeController {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly me: MeService,
  ) {}

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

        const [appointments, diagnoses, invoices, visits, reports, vitals, prescriptions] =
          await Promise.all([
            searchAppointments(db, { patientId, limit: 20 }),
            listDiagnosesByPatient(db, patientId),
            listInvoicesByPatient(db, patientId),
            listVisitsByPatient(db, patientId),
            listReportsByPatient(db, patientId),
            listVitalsByPatient(db, patientId),
            listPrescriptionsByPatient(db, patientId),
          ]);
        // Flatten prescription items into a medications list.
        const medications = (
          await Promise.all(
            prescriptions.map(async (p) => {
              const items = await listPrescriptionItems(db, p.id);
              return items.map((it) => ({
                id: it.id,
                name: `${it.drugName} ${it.strength}`,
                dose: it.dose,
                frequency: it.frequency,
                duration: it.duration,
                status: p.status,
                prescribedAt: p.createdAt.toISOString(),
              }));
            }),
          )
        ).flat();

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
          visits: visits.map((v) => ({
            id: v.id,
            status: v.status,
            chiefComplaint: v.chiefComplaint ?? null,
            date: v.periodStart.toISOString(),
            signed: v.signedAt !== null,
          })),
          reports: reports.map((r) => ({
            id: r.id,
            status: r.status,
            conclusion: r.conclusion,
            issuedAt: r.issuedAt.toISOString(),
          })),
          vitals: vitals.map((v) => ({
            id: v.id,
            code: v.code,
            display: v.display,
            valueNumeric: v.valueNumeric ?? null,
            unit: v.unit ?? null,
            valueText: v.valueText ?? null,
            effectiveAt: v.effectiveAt.toISOString(),
          })),
          medications,
        };
      },
    );
  }

  @Get("practitioners")
  @RequirePermission("self:read")
  async practitioners(@CurrentPrincipal() principal: Principal): Promise<BookableOptionsResponse> {
    const practitioners = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => listBookablePractitioners(db),
    );
    return { practitioners };
  }

  @Get("slots")
  @RequirePermission("self:read")
  async slots(
    @CurrentPrincipal() principal: Principal,
    @Query("practitionerId") practitionerId?: string,
    @Query("date") date?: string,
  ): Promise<SlotsResponse> {
    const uuid = /^[0-9a-f-]{36}$/i;
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (!practitionerId || !uuid.test(practitionerId) || !date || !day.test(date)) {
      return { practitionerId: practitionerId ?? "", date: date ?? "", slots: [] };
    }
    const slots = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => computeFreeSlots(db, practitionerId, date),
    );
    return {
      practitionerId,
      date,
      slots: slots.map((s) => ({ startAt: s.startAt.toISOString(), endAt: s.endAt.toISOString() })),
    };
  }

  @Post("appointments")
  @HttpCode(201)
  @RequirePermission("self:book")
  async book(
    @CurrentPrincipal() principal: Principal,
    @Body() rawBody: unknown,
  ): Promise<MyAppointment> {
    const patientId = principal.patientId;
    if (!patientId) throw new NotFoundError("No patient record for this token");
    const req = bookMyAppointmentRequestSchema.parse(rawBody);

    const start = new Date(req.startAt);
    const end = new Date(start.getTime() + VISIT_MINUTES * 60_000);

    // The patient id comes from the TOKEN — a patient can only book for self.
    const a = await this.me.book(principal, {
      patientId,
      practitionerId: req.practitionerId,
      facilityId: req.facilityId,
      departmentId: req.departmentId,
      startAt: start,
      endAt: end,
      reasonText: req.reasonText,
    });

    return {
      id: a.id,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      status: a.status,
      appointmentType: a.appointmentType,
      reasonText: a.reasonText ?? null,
    };
  }
}
