/**
 * Pharmacy application service — the transaction boundary (BDR-0004). Manage the
 * formulary + batched stock, write prescriptions, and dispense (drawing stock
 * down FEFO — earliest expiry first) in one tenant transaction, with audit +
 * transactional outbox. Insufficient stock or a re-dispense fails closed.
 */
import { Injectable } from "@nestjs/common";
import {
  batchesForDrugFefo,
  decrementBatch,
  getDrugById,
  getPatientById,
  getPrescriptionById,
  insertDispense,
  insertDispenseItem,
  insertDrug,
  insertOutboxEvent,
  insertPrescription,
  insertPrescriptionItem,
  insertStockBatch,
  isForeignKeyViolation,
  isUniqueViolation,
  listDrugStock,
  listPrescriptionItems,
  listPrescriptions,
  markPrescriptionStatus,
  newId,
  type DrugStockRow,
  type PrescriptionRowWithPatient,
  type TenantDb,
} from "@aiims/db";
import type {
  AddStockRequest,
  CreateDrugRequest,
  CreatePrescriptionRequest,
  DispenseResponse,
  PrescriptionResponse,
} from "@aiims/api-contracts";
import type { Principal } from "@aiims/domain-types";
import { MEDICATION_DISPENSED_V1, PRESCRIPTION_WRITTEN_V1 } from "@aiims/event-schemas";
import { ConflictError, NotFoundError } from "../../../common/errors";
import { AuditService } from "../../../platform/audit.service";
import { UnitOfWork } from "../../../platform/db.provider";

type Actor = { tenantId: string; actorId: string };

@Injectable()
export class PharmacyService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly audit: AuditService,
  ) {}

  private actor(p: Principal): Actor {
    return { tenantId: p.tenantId, actorId: p.actorId };
  }

  listDrugs(principal: Principal): Promise<DrugStockRow[]> {
    return this.uow.withTenant(this.actor(principal), (db) => listDrugStock(db));
  }

  async addDrug(principal: Principal, req: CreateDrugRequest): Promise<DrugStockRow> {
    const actor = this.actor(principal);
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const drug = await insertDrug(db, {
          id: newId(),
          tenantId: principal.tenantId,
          name: req.name,
          form: req.form,
          strength: req.strength,
          unit: req.unit,
          category: req.category ?? null,
          reorderLevel: req.reorderLevel,
        });
        await this.audit.append(db, actor, {
          eventId: newId(),
          action: "pharmacy.drug.add",
          resourceType: "drug",
          resourceId: drug.id,
          occurredAt: new Date(),
        });
        return { ...drug, totalQty: 0 };
      });
    } catch (err) {
      if (isUniqueViolation(err))
        throw new ConflictError("That drug already exists in the formulary.");
      throw err;
    }
  }

  async addStock(
    principal: Principal,
    drugId: string,
    req: AddStockRequest,
  ): Promise<DrugStockRow> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const drug = await getDrugById(db, drugId);
      if (!drug) throw new NotFoundError("Drug not found");
      await insertStockBatch(db, {
        id: newId(),
        tenantId: principal.tenantId,
        drugId,
        batchNo: req.batchNo,
        expiryDate: req.expiryDate,
        quantity: req.quantity,
        mrp: req.mrp,
      });
      await this.audit.append(db, actor, {
        eventId: newId(),
        action: "pharmacy.stock.receive",
        resourceType: "drug",
        resourceId: drugId,
        occurredAt: new Date(),
      });
      const [row] = (await listDrugStock(db)).filter((d) => d.id === drugId);
      return row ?? { ...drug, totalQty: req.quantity };
    });
  }

  async writePrescription(
    principal: Principal,
    req: CreatePrescriptionRequest,
  ): Promise<PrescriptionResponse> {
    const actor = this.actor(principal);
    try {
      return await this.uow.withTenant(actor, async (db) => {
        const patient = await getPatientById(db, req.patientId);
        if (!patient) throw new NotFoundError("Patient not found");

        const id = newId();
        const presc = await insertPrescription(db, {
          id,
          tenantId: principal.tenantId,
          patientId: req.patientId,
          encounterId: req.encounterId ?? null,
          prescriberId: principal.actorId,
          note: req.note ?? null,
        });
        for (const it of req.items) {
          const drug = await getDrugById(db, it.drugId);
          if (!drug) throw new NotFoundError(`Drug ${it.drugId} not found`);
          await insertPrescriptionItem(db, {
            id: newId(),
            tenantId: principal.tenantId,
            prescriptionId: id,
            drugId: it.drugId,
            dose: it.dose,
            frequency: it.frequency,
            duration: it.duration,
            quantity: it.quantity,
            instructions: it.instructions ?? null,
          });
        }
        const eventId = newId();
        await insertOutboxEvent(db, {
          id: eventId,
          tenantId: principal.tenantId,
          aggregateType: "prescription",
          aggregateId: id,
          eventType: PRESCRIPTION_WRITTEN_V1,
          payload: {
            prescriptionId: id,
            patientId: req.patientId,
            prescriberId: principal.actorId,
            itemCount: req.items.length,
          },
        });
        await this.audit.append(db, actor, {
          eventId,
          action: "prescription.write",
          resourceType: "prescription",
          resourceId: id,
          occurredAt: new Date(),
        });
        // insertPrescription's RETURNING has no join, so the patient name
        // (already fetched above to validate the patient exists) is attached
        // here rather than re-queried.
        return this.view(db, {
          ...presc,
          patientName: `${patient.nameGiven} ${patient.nameFamily}`,
        });
      });
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new NotFoundError("Patient or drug not found");
      throw err;
    }
  }

  async listPrescriptions(
    principal: Principal,
    status?: "active" | "dispensed" | "cancelled",
  ): Promise<PrescriptionResponse[]> {
    return this.uow.withTenant(this.actor(principal), async (db) => {
      const rows = await listPrescriptions(db, status);
      // Sequential: view() queries share this transaction's one pg client, so
      // concurrent awaits on it are deprecated (pg#9 removes support).
      const out: PrescriptionResponse[] = [];
      for (const r of rows) {
        out.push(await this.view(db, r));
      }
      return out;
    });
  }

  async dispense(principal: Principal, prescriptionId: string): Promise<DispenseResponse> {
    const actor = this.actor(principal);
    return this.uow.withTenant(actor, async (db) => {
      const presc = await getPrescriptionById(db, prescriptionId);
      if (!presc) throw new NotFoundError("Prescription not found");
      if (presc.status !== "active") throw new ConflictError("Prescription is not active.");

      const items = await listPrescriptionItems(db, prescriptionId);
      const dispenseId = newId();

      // Header first so the dispense_item FK (→ dispense) is satisfied.
      await insertDispense(db, {
        id: dispenseId,
        tenantId: principal.tenantId,
        prescriptionId,
        patientId: presc.patientId,
        dispensedBy: principal.actorId,
      });

      // FEFO draw-down: allocate each item across batches, earliest expiry first.
      for (const it of items) {
        let remaining = it.quantity;
        const batches = await batchesForDrugFefo(db, it.drugId);
        for (const b of batches) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, b.quantity);
          await decrementBatch(db, b.id, take);
          await insertDispenseItem(db, {
            id: newId(),
            tenantId: principal.tenantId,
            dispenseId,
            drugId: it.drugId,
            batchId: b.id,
            quantity: take,
          });
          remaining -= take;
        }
        if (remaining > 0) {
          throw new ConflictError(`Insufficient stock for ${it.drugName} — short by ${remaining}.`);
        }
      }

      const moved = await markPrescriptionStatus(db, prescriptionId, presc.version, "dispensed");
      if (!moved) throw new ConflictError("Prescription changed — please retry.");

      const eventId = newId();
      await insertOutboxEvent(db, {
        id: eventId,
        tenantId: principal.tenantId,
        aggregateType: "prescription",
        aggregateId: prescriptionId,
        eventType: MEDICATION_DISPENSED_V1,
        payload: { dispenseId, prescriptionId, patientId: presc.patientId },
      });
      await this.audit.append(db, actor, {
        eventId,
        action: "medication.dispense",
        resourceType: "prescription",
        resourceId: prescriptionId,
        occurredAt: new Date(),
      });

      return { dispenseId, prescriptionId, status: "dispensed" as const };
    });
  }

  private async view(
    db: TenantDb,
    presc: PrescriptionRowWithPatient,
  ): Promise<PrescriptionResponse> {
    const items = await listPrescriptionItems(db, presc.id);
    return {
      id: presc.id,
      patientId: presc.patientId,
      patientName: presc.patientName,
      encounterId: presc.encounterId,
      prescriberId: presc.prescriberId,
      status: presc.status,
      note: presc.note,
      version: presc.version,
      createdAt: presc.createdAt.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        drugId: i.drugId,
        drugName: i.drugName,
        strength: i.strength,
        form: i.form,
        dose: i.dose,
        frequency: i.frequency,
        duration: i.duration,
        quantity: i.quantity,
        instructions: i.instructions,
      })),
    };
  }
}
