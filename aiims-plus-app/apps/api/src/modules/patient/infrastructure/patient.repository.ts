/**
 * Repository implementation: the encryption boundary (DDR-0006).
 * Domain (plaintext) ↔ rows (ciphertext + blind indexes) via CryptoService;
 * persistence via the typed helpers in @aiims/db (Drizzle stays confined).
 * Always called inside a tenant-context transaction (BDR-0004).
 */
import { Injectable } from "@nestjs/common";
import {
  findPatientByBlindIndex,
  findPatientByMrn,
  getPatientById,
  insertPatient,
  listPatients,
  searchPatientsByText,
  updatePatientVersioned,
  type PatientRow,
  type TenantDb,
  type UpdatePatientChanges,
} from "@aiims/db";
import { CryptoService } from "../../../platform/crypto.provider";
import { Patient, type DemographicChanges } from "../domain/patient";
import type {
  DataContext,
  PatientRepository,
  PatientSearch,
} from "../ports/patient-repository.port";

@Injectable()
export class EncryptedPatientRepository implements PatientRepository {
  constructor(private readonly crypto: CryptoService) {}

  async insert(ctx: DataContext, patient: Patient): Promise<void> {
    const db = ctx as TenantDb;
    const p = patient.props;
    const aad = { tenantId: p.tenantId, recordId: p.id };
    const { keyRef, values } = await this.crypto.cipher.encryptRecord(
      { phone: p.phone, email: p.email, abha_number: p.abhaNumber },
      aad,
    );
    await insertPatient(db, {
      id: p.id,
      tenantId: p.tenantId,
      mrn: p.mrn,
      nameGiven: p.nameGiven,
      nameFamily: p.nameFamily,
      gender: p.gender,
      birthDate: p.birthDate,
      abhaAddress: p.abhaAddress,
      abhaNumberEnc: values.abha_number ?? null,
      abhaNumberBidx: p.abhaNumber
        ? this.crypto.blindIndex("abha", p.tenantId, p.abhaNumber)
        : null,
      phoneEnc: values.phone ?? null,
      phoneBidx: p.phone ? this.crypto.blindIndex("phone", p.tenantId, p.phone) : null,
      emailEnc: values.email ?? null,
      emailBidx: p.email ? this.crypto.blindIndex("email", p.tenantId, p.email) : null,
      encKeyRef: keyRef,
      address: p.address,
    });
  }

  async findById(ctx: DataContext, id: string): Promise<Patient | undefined> {
    const row = await getPatientById(ctx as TenantDb, id);
    return row ? this.toDomain(row) : undefined;
  }

  async search(ctx: DataContext, query: PatientSearch): Promise<Patient[]> {
    const db = ctx as TenantDb;
    if (query.identifier) {
      const digest = this.crypto.blindIndex(
        query.identifier.kind,
        query.tenantId,
        query.identifier.value,
      );
      const row = await findPatientByBlindIndex(db, query.identifier.kind, digest);
      return row ? [await this.toDomain(row)] : [];
    }
    if (query.mrn) {
      const row = await findPatientByMrn(db, query.mrn);
      return row ? [await this.toDomain(row)] : [];
    }
    const rows = query.q
      ? await searchPatientsByText(db, query.q, query.limit)
      : await listPatients(db, query.limit, query.cursor);
    return Promise.all(rows.map((r) => this.toDomain(r)));
  }

  async update(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: DemographicChanges,
  ): Promise<Patient | "conflict" | "missing"> {
    const db = ctx as TenantDb;
    const existing = await getPatientById(db, id);
    if (!existing) return "missing";

    const rowChanges: UpdatePatientChanges = {
      ...(changes.nameGiven !== undefined ? { nameGiven: changes.nameGiven } : {}),
      ...(changes.nameFamily !== undefined ? { nameFamily: changes.nameFamily } : {}),
      ...(changes.gender !== undefined ? { gender: changes.gender } : {}),
      ...(changes.birthDate !== undefined ? { birthDate: changes.birthDate } : {}),
      ...(changes.address !== undefined ? { address: changes.address } : {}),
    };

    // Identifier changes re-encrypt under the record's existing data key
    // (or mint one if the record never had encrypted fields).
    if (changes.phone !== undefined || changes.email !== undefined) {
      const aad = { tenantId: existing.tenantId, recordId: existing.id };
      const fields = {
        ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
        ...(changes.email !== undefined ? { email: changes.email } : {}),
      };
      let keyRef = existing.encKeyRef;
      let values;
      if (keyRef) {
        values = await this.crypto.cipher.encryptWithExistingKey(keyRef, fields, aad);
      } else {
        const sealed = await this.crypto.cipher.encryptRecord(fields, aad);
        keyRef = sealed.keyRef;
        values = sealed.values;
        rowChanges.encKeyRef = keyRef;
      }
      if (changes.phone !== undefined) {
        rowChanges.phoneEnc = values.phone ?? null;
        rowChanges.phoneBidx = changes.phone
          ? this.crypto.blindIndex("phone", existing.tenantId, changes.phone)
          : null;
      }
      if (changes.email !== undefined) {
        rowChanges.emailEnc = values.email ?? null;
        rowChanges.emailBidx = changes.email
          ? this.crypto.blindIndex("email", existing.tenantId, changes.email)
          : null;
      }
    }

    const updated = await updatePatientVersioned(db, id, expectedVersion, rowChanges);
    return updated ? this.toDomain(updated) : "conflict";
  }

  private async toDomain(row: PatientRow): Promise<Patient> {
    let plain: Record<string, string | null> = { phone: null, email: null, abha_number: null };
    if (row.encKeyRef) {
      plain = await this.crypto.cipher.decryptRecord(
        row.encKeyRef,
        { phone: row.phoneEnc, email: row.emailEnc, abha_number: row.abhaNumberEnc },
        { tenantId: row.tenantId, recordId: row.id },
      );
    }
    return Patient.fromPersistence({
      id: row.id,
      tenantId: row.tenantId,
      mrn: row.mrn,
      nameGiven: row.nameGiven,
      nameFamily: row.nameFamily,
      gender: row.gender,
      birthDate: row.birthDate,
      phone: plain.phone ?? null,
      email: plain.email ?? null,
      abhaNumber: plain.abha_number ?? null,
      abhaAddress: row.abhaAddress,
      address: (row.address as Record<string, unknown> | null) ?? null,
      version: row.version,
      createdAt: row.createdAt,
    });
  }
}
