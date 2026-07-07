/**
 * Billing application service — the transaction boundary (BDR-0004). Invoice an
 * encounter (charge capture), settle via the mock payment gateway, and (mock)
 * share the care context on consent — closing the OPD golden path. Money is
 * computed in INTEGER PAISE and stored as `numeric` strings (never float, DB §4).
 * External calls (payment/consent/ABDM) happen OUTSIDE the unit of work (BDR-0004).
 */
import { Inject, Injectable } from "@nestjs/common";
import type {
  GenerateInvoiceRequest,
  PayInvoiceRequest,
  ShareEncounterRequest,
} from "@aiims/api-contracts";
import {
  findIdempotentResource,
  getEncounterById,
  getInvoiceById,
  getInvoiceByEncounter,
  insertInvoice,
  insertInvoiceLine,
  insertOutboxEvent,
  isForeignKeyViolation,
  isUniqueViolation,
  issueInvoiceNumber,
  listInvoiceLines,
  listServiceRequestsByEncounter,
  markInvoicePaidVersioned,
  newId,
  saveIdempotencyKey,
  type InvoiceLineRow,
  type InvoiceRow,
  type TenantDb,
} from "@aiims/db";
import type { Principal } from "@aiims/domain-types";
import { ENCOUNTER_SHARED_V1, INVOICE_ISSUED_V1, INVOICE_PAID_V1 } from "@aiims/event-schemas";
import {
  ABDM_GATEWAY,
  CONSENT_PROVIDER,
  PAYMENT_GATEWAY,
  type AbdmGateway,
  type ConsentProvider,
  type PaymentGateway,
} from "../../../adapters/ports";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

const PAY_ENDPOINT = "POST /v1/invoices/{id}/pay";
const DEFAULT_CONSULTATION = "500.00";
const PER_ORDER_CHARGE = "200.00";

const toPaise = (money: string): number => Math.round(Number(money) * 100);
const fromPaise = (paise: number): string => (paise / 100).toFixed(2);

type Actor = { tenantId: string; actorId: string };

export interface InvoiceView {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
}

@Injectable()
export class BillingService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly payment: PaymentGateway,
    @Inject(CONSENT_PROVIDER) private readonly consent: ConsentProvider,
    @Inject(ABDM_GATEWAY) private readonly abdm: AbdmGateway,
  ) {}

  private actor(principal: Principal): Actor {
    return { tenantId: principal.tenantId, actorId: principal.actorId };
  }

  async generate(
    principal: Principal,
    encounterId: string,
    req: GenerateInvoiceRequest,
  ): Promise<InvoiceView> {
    const actor = this.actor(principal);
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const enc = await getEncounterById(db, encounterId);
        if (!enc) throw new NotFoundError("Encounter not found");

        // Charge capture: consultation + one line per order placed on the encounter.
        const orders = await listServiceRequestsByEncounter(db, encounterId);
        const consultation = req.consultationFee ?? DEFAULT_CONSULTATION;
        const lineSpecs: {
          description: string;
          code?: { system: string; code: string; display: string };
          unit: string;
        }[] = [{ description: "OPD consultation", unit: consultation }];
        for (const o of orders) {
          lineSpecs.push({
            description: `Investigation: ${o.display}`,
            code: { system: o.codeSystem, code: o.code, display: o.display },
            unit: PER_ORDER_CHARGE,
          });
        }
        const subtotalPaise = lineSpecs.reduce((sum, l) => sum + toPaise(l.unit), 0);
        const total = fromPaise(subtotalPaise);

        const invoiceId = newId();
        const invoiceNumber = await issueInvoiceNumber(db, principal.tenantId);
        const invoice = await insertInvoice(db, {
          id: invoiceId,
          tenantId: principal.tenantId,
          invoiceNumber,
          encounterId,
          patientId: enc.patientId,
          currency: "INR",
          subtotal: total,
          total,
        });
        const lines: InvoiceLineRow[] = [];
        for (const spec of lineSpecs) {
          lines.push(
            await insertInvoiceLine(db, {
              id: newId(),
              tenantId: principal.tenantId,
              invoiceId,
              description: spec.description,
              codeSystem: spec.code?.system ?? null,
              code: spec.code?.code ?? null,
              display: spec.code?.display ?? null,
              quantity: 1,
              unitAmount: spec.unit,
              lineAmount: spec.unit,
            }),
          );
        }

        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "invoice",
          aggregateId: invoiceId,
          eventType: INVOICE_ISSUED_V1,
          payload: { invoiceId, encounterId },
        });
        await this.audit.append(db, actor, {
          eventId,
          action: "invoice.issue",
          resourceType: "invoice",
          resourceId: invoiceId,
          occurredAt: new Date(),
        });
        return { invoice, lines };
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictError("An invoice already exists for this encounter");
      if (isForeignKeyViolation(err)) throw new NotFoundError("Encounter not found in this tenant");
      throw err;
    }
  }

  async getById(principal: Principal, id: string): Promise<InvoiceView> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const invoice = await getInvoiceById(db, id);
      if (!invoice) throw new NotFoundError("Invoice not found");
      const lines = await listInvoiceLines(db, id);
      await this.auditRead(db, actor, id);
      return { invoice, lines };
    });
  }

  async getByEncounter(principal: Principal, encounterId: string): Promise<InvoiceView> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const invoice = await getInvoiceByEncounter(db, encounterId);
      if (!invoice) throw new NotFoundError("No invoice for this encounter");
      const lines = await listInvoiceLines(db, invoice.id);
      await this.auditRead(db, actor, invoice.id);
      return { invoice, lines };
    });
  }

  async pay(
    principal: Principal,
    invoiceId: string,
    req: PayInvoiceRequest,
    idempotencyKey: string,
  ): Promise<InvoiceView> {
    const actor = this.actor(principal);

    // Read + idempotency (tx1); no external call inside the unit of work (BDR-0004).
    const pre = await this.uow.withTenant(actor, async (db) => {
      const replayId = await findIdempotentResource(db, PAY_ENDPOINT, idempotencyKey);
      if (replayId) {
        const inv = await getInvoiceById(db, replayId);
        if (!inv) throw new ConflictError("Idempotency key maps to a missing invoice");
        return { replay: { invoice: inv, lines: await listInvoiceLines(db, inv.id) } };
      }
      const inv = await getInvoiceById(db, invoiceId);
      if (!inv) throw new NotFoundError("Invoice not found");
      if (inv.status !== "issued") throw new ConflictError("Invoice is already paid or cancelled");
      return { invoice: inv };
    });
    if (pre.replay) return pre.replay;

    // External payment (mock) OUTSIDE the transaction.
    const { intentRef } = await this.payment.createPaymentIntent({
      amount: pre.invoice!.total,
      currency: pre.invoice!.currency,
      reference: pre.invoice!.invoiceNumber,
    });

    // Persist the settlement atomically (tx2).
    return this.uow.withTenant(actor, async (db) => {
      const paid = await markInvoicePaidVersioned(db, invoiceId, pre.invoice!.version, {
        paymentRef: intentRef,
        paymentMethod: req.method,
      });
      if (!paid) throw new ConflictError("Invoice was modified concurrently — refetch and retry");
      await saveIdempotencyKey(db, {
        tenantId: principal.tenantId,
        endpoint: PAY_ENDPOINT,
        key: idempotencyKey,
        resourceId: invoiceId,
      });
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "invoice",
        aggregateId: invoiceId,
        eventType: INVOICE_PAID_V1,
        payload: { invoiceId, version: paid.version },
      });
      await this.audit.append(db, actor, {
        eventId,
        action: "invoice.pay",
        resourceType: "invoice",
        resourceId: invoiceId,
        occurredAt: new Date(),
      });
      return { invoice: paid, lines: await listInvoiceLines(db, invoiceId) };
    });
  }

  async share(
    principal: Principal,
    encounterId: string,
    req: ShareEncounterRequest,
  ): Promise<{
    encounterId: string;
    consentArtifactRef: string;
    careContextRef: string;
    sharedAt: string;
  }> {
    const actor = this.actor(principal);

    // Read the encounter (tx1) to get the patient subject.
    const enc = await this.uow.withTenant(actor, async (db) => {
      const e = await getEncounterById(db, encounterId);
      if (!e) throw new NotFoundError("Encounter not found");
      return e;
    });

    // External consent validation + care-context link (mock), OUTSIDE the tx.
    const consent = await this.consent.validateConsent({
      subjectId: enc.patientId,
      purpose: req.purpose,
      scope: req.scope,
    });
    if (!consent.valid) throw new ConflictError("Consent could not be validated for this share");
    const { careContextRef } = await this.abdm.linkCareContext({
      patientRef: `Patient/${enc.patientId}`,
      encounterRef: `Encounter/${encounterId}`,
      consentArtifactRef: consent.artifactRef,
    });

    // Record the share (tx2).
    const sharedAt = new Date();
    await this.uow.withTenant(actor, async (db) => {
      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "encounter",
        aggregateId: encounterId,
        eventType: ENCOUNTER_SHARED_V1,
        payload: { encounterId, patientId: enc.patientId },
      });
      await this.audit.append(db, actor, {
        eventId,
        action: "encounter.share",
        resourceType: "encounter",
        resourceId: encounterId,
        occurredAt: sharedAt,
      });
    });

    return {
      encounterId,
      consentArtifactRef: consent.artifactRef,
      careContextRef,
      sharedAt: sharedAt.toISOString(),
    };
  }

  private async auditRead(db: TenantDb, actor: Actor, invoiceId: string): Promise<void> {
    await this.audit.append(db, actor, {
      eventId: newId(),
      action: "invoice.read",
      resourceType: "invoice",
      resourceId: invoiceId,
      occurredAt: new Date(),
    });
  }
}
