/**
 * Laboratory application service. Two operations for the lab desk:
 *   • worklist  — every lab order for a facility (pending + resulted), so lab
 *                 staff work one queue.
 *   • fileResult — file a diagnostic report + structured analyte lines against
 *                 an order, mark the order completed, emit outbox + audit, all
 *                 in one tenant transaction.
 *
 * `diagnostic_report.filed_by` FKs to a practitioner. We attribute it to the
 * operator's practitioner profile when they have one; otherwise we fall back to
 * the order's requester (the ordering doctor). Either way the tamper-evident
 * audit records the TRUE actor (principal.actorId) — that is the source of
 * truth for "who filed this".
 */
import { Injectable } from "@nestjs/common";
import {
  getPractitionerIdByAppUser,
  getServiceRequestById,
  insertDiagnosticReport,
  insertLabResultLines,
  insertOutboxEvent,
  listLabResultLines,
  listLabWorklist,
  markServiceRequestCompleted,
  newId,
} from "@aiims/db";
import { DIAGNOSTIC_REPORT_FILED_V1 } from "@aiims/event-schemas";
import type {
  FileLabResultRequest,
  LabResultResponse,
  LabWorklistItem,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

@Injectable()
export class LaboratoryService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  async worklist(
    principal: Principal,
    facilityId: string,
    category: "lab" | "imaging" | "other" = "lab",
  ): Promise<LabWorklistItem[]> {
    const rows = await this.uow.withTenant(
      { tenantId: principal.tenantId, actorId: principal.actorId },
      (db) => listLabWorklist(db, facilityId, category),
    );
    return rows.map((r) => ({
      orderId: r.orderId,
      encounterId: r.encounterId,
      patientId: r.patientId,
      patientName: r.patientName,
      code: r.code,
      codeSystem: r.codeSystem,
      display: r.display,
      priority: r.priority,
      orderStatus: r.orderStatus,
      orderedAt: r.orderedAt.toISOString(),
      reportId: r.reportId,
      reportStatus: r.reportStatus,
      conclusion: r.conclusion,
      issuedAt: r.issuedAt ? r.issuedAt.toISOString() : null,
    }));
  }

  async fileResult(
    principal: Principal,
    orderId: string,
    req: FileLabResultRequest,
  ): Promise<LabResultResponse> {
    const actor = { tenantId: principal.tenantId, actorId: principal.actorId };
    return this.uow.withTenant(actor, async (db) => {
      const order = await getServiceRequestById(db, orderId);
      if (!order) throw new NotFoundError("Lab order not found");

      // Attribute the clinical record to the operator's practitioner profile,
      // falling back to the ordering practitioner. The audit below records the
      // real actor regardless.
      const operatorPractitioner = await getPractitionerIdByAppUser(db, principal.actorId);
      const filedBy = operatorPractitioner ?? order.requesterId;

      const report = await insertDiagnosticReport(db, {
        id: newId(),
        tenantId: principal.tenantId,
        serviceRequestId: orderId,
        encounterId: order.encounterId,
        patientId: order.patientId,
        status: req.status,
        conclusion: req.conclusion,
        attachmentId: null,
        filedBy,
      });

      await insertLabResultLines(db, principal.tenantId, report.id, req.lines, newId);
      await markServiceRequestCompleted(db, orderId);

      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "diagnostic_report",
        aggregateId: report.id,
        eventType: DIAGNOSTIC_REPORT_FILED_V1,
        payload: {
          diagnosticReportId: report.id,
          serviceRequestId: orderId,
          encounterId: order.encounterId,
        },
      });
      await this.audit.append(db, actor, {
        eventId,
        action: "lab.result.file",
        resourceType: "diagnostic_report",
        resourceId: report.id,
        occurredAt: new Date(),
      });

      const lines = await listLabResultLines(db, report.id);
      return {
        reportId: report.id,
        orderId,
        status: report.status,
        conclusion: report.conclusion,
        lines: lines.map((l) => ({
          id: l.id,
          analyte: l.analyte,
          value: l.value,
          unit: l.unit ?? null,
          referenceRange: l.referenceRange ?? null,
          flag: l.flag,
        })),
        issuedAt: report.issuedAt.toISOString(),
      };
    });
  }
}
