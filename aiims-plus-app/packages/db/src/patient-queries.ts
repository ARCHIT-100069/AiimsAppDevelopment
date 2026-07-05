/**
 * Stage 2 data-access helpers (Patient). Drizzle stays confined here; the
 * repository layer maps domain ↔ these row shapes. Every helper requires a
 * tenant-scoped transaction (DDR-0002). Encryption happens ABOVE this layer
 * (the repo owns the cipher); this layer only moves buffers.
 */
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Keyset } from "./platform-queries";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface PatientRow {
  id: string;
  tenantId: string;
  mrn: string;
  nameGiven: string;
  nameFamily: string;
  gender: "male" | "female" | "other" | "unknown";
  birthDate: string;
  abhaAddress: string | null;
  abhaNumberEnc: Buffer | null;
  phoneEnc: Buffer | null;
  emailEnc: Buffer | null;
  encKeyRef: string | null;
  address: unknown;
  fhirExtensions: unknown;
  version: number;
  createdAt: Date;
}

const patientColumns = {
  id: s.patient.id,
  tenantId: s.patient.tenantId,
  mrn: s.patient.mrn,
  nameGiven: s.patient.nameGiven,
  nameFamily: s.patient.nameFamily,
  gender: s.patient.gender,
  birthDate: s.patient.birthDate,
  abhaAddress: s.patient.abhaAddress,
  abhaNumberEnc: s.patient.abhaNumberEnc,
  phoneEnc: s.patient.phoneEnc,
  emailEnc: s.patient.emailEnc,
  encKeyRef: s.patient.encKeyRef,
  address: s.patient.address,
  fhirExtensions: s.patient.fhirExtensions,
  version: s.patient.version,
  createdAt: s.patient.createdAt,
} as const;

const notDeleted = isNull(s.patient.deletedAt);

/** MRN issuance (decision S2-c): atomic per-tenant counter, format MRN-%06d. */
export async function issueMrn(db: TenantDb, tenantId: string): Promise<string> {
  const [row] = await db
    .insert(s.mrnCounter)
    .values({ tenantId, lastValue: 1 })
    .onConflictDoUpdate({
      target: s.mrnCounter.tenantId,
      set: { lastValue: sql`${s.mrnCounter.lastValue} + 1` },
    })
    .returning({ lastValue: s.mrnCounter.lastValue });
  if (!row) throw new Error("mrn counter upsert returned no row");
  return `MRN-${String(row.lastValue).padStart(6, "0")}`;
}

export interface InsertPatientInput {
  id: string;
  tenantId: string;
  mrn: string;
  nameGiven: string;
  nameFamily: string;
  gender: PatientRow["gender"];
  birthDate: string;
  abhaAddress?: string | null;
  abhaNumberEnc?: Buffer | null;
  abhaNumberBidx?: Buffer | null;
  phoneEnc?: Buffer | null;
  phoneBidx?: Buffer | null;
  emailEnc?: Buffer | null;
  emailBidx?: Buffer | null;
  encKeyRef?: string | null;
  address?: Record<string, unknown> | null;
}

export async function insertPatient(db: TenantDb, input: InsertPatientInput): Promise<PatientRow> {
  const [row] = await db.insert(s.patient).values(input).returning(patientColumns);
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function getPatientById(db: TenantDb, id: string): Promise<PatientRow | undefined> {
  const [row] = await db
    .select(patientColumns)
    .from(s.patient)
    .where(and(eq(s.patient.id, id), notDeleted))
    .limit(1);
  return row;
}

/** Free-text: trigram name match OR MRN prefix (Blueprint §17 Postgres FTS). */
export async function searchPatientsByText(
  db: TenantDb,
  q: string,
  limit: number,
): Promise<PatientRow[]> {
  const needle = `%${q.replace(/[%_]/g, "\\$&")}%`;
  return db
    .select(patientColumns)
    .from(s.patient)
    .where(
      and(
        notDeleted,
        or(
          ilike(sql`${s.patient.nameGiven} || ' ' || ${s.patient.nameFamily}`, needle),
          ilike(s.patient.mrn, `${q.replace(/[%_]/g, "\\$&")}%`),
        ),
      ),
    )
    .orderBy(desc(s.patient.createdAt), desc(s.patient.id))
    .limit(limit);
}

export async function findPatientByMrn(db: TenantDb, mrn: string): Promise<PatientRow | undefined> {
  const [row] = await db
    .select(patientColumns)
    .from(s.patient)
    .where(and(eq(s.patient.mrn, mrn), notDeleted))
    .limit(1);
  return row;
}

/** Exact-match on an encrypted identifier via its blind index (DDR-0006). */
export async function findPatientByBlindIndex(
  db: TenantDb,
  kind: "phone" | "email" | "abha",
  digest: Buffer,
): Promise<PatientRow | undefined> {
  const column =
    kind === "phone"
      ? s.patient.phoneBidx
      : kind === "email"
        ? s.patient.emailBidx
        : s.patient.abhaNumberBidx;
  const [row] = await db
    .select(patientColumns)
    .from(s.patient)
    .where(and(eq(column, digest), notDeleted))
    .limit(1);
  return row;
}

export async function listPatients(db: TenantDb, limit: number, k?: Keyset): Promise<PatientRow[]> {
  const cursorCond = k
    ? or(
        sql`${s.patient.createdAt} < ${k.beforeCreatedAt}`,
        and(eq(s.patient.createdAt, k.beforeCreatedAt), sql`${s.patient.id} < ${k.beforeId}`),
      )
    : undefined;
  return db
    .select(patientColumns)
    .from(s.patient)
    .where(and(notDeleted, cursorCond))
    .orderBy(desc(s.patient.createdAt), desc(s.patient.id))
    .limit(limit);
}

export interface UpdatePatientChanges {
  nameGiven?: string;
  nameFamily?: string;
  gender?: PatientRow["gender"];
  birthDate?: string;
  address?: Record<string, unknown> | null;
  phoneEnc?: Buffer | null;
  phoneBidx?: Buffer | null;
  emailEnc?: Buffer | null;
  emailBidx?: Buffer | null;
  encKeyRef?: string;
}

/** Optimistic concurrency (DDR-0009): 0 rows ⇒ stale version ⇒ caller maps 409. */
export async function updatePatientVersioned(
  db: TenantDb,
  id: string,
  expectedVersion: number,
  changes: UpdatePatientChanges,
): Promise<PatientRow | undefined> {
  const [row] = await db
    .update(s.patient)
    .set({ ...changes, version: sql`${s.patient.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(s.patient.id, id), eq(s.patient.version, expectedVersion), notDeleted))
    .returning(patientColumns);
  return row;
}

/* ------------------------- idempotency (APDR-0006) ----------------------- */

export async function findIdempotentResource(
  db: TenantDb,
  endpoint: string,
  key: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ resourceId: s.idempotencyKey.resourceId })
    .from(s.idempotencyKey)
    .where(and(eq(s.idempotencyKey.endpoint, endpoint), eq(s.idempotencyKey.key, key)))
    .limit(1);
  return row?.resourceId;
}

/** Written in the SAME transaction as the resource it protects (S2-e). */
export async function saveIdempotencyKey(
  db: TenantDb,
  input: { tenantId: string; endpoint: string; key: string; resourceId: string },
): Promise<void> {
  await db.insert(s.idempotencyKey).values(input);
}
