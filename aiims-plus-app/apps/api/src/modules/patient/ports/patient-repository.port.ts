/**
 * Repository port (BDR-0003) — domain-owned, intention-revealing, returns
 * domain objects. `DataContext` stays opaque (the tenant-scoped transaction);
 * encryption/blind-indexing happen inside the implementation.
 */
import type { DemographicChanges, Patient } from "../domain/patient";

export type DataContext = unknown;

export type IdentifierKind = "phone" | "email" | "abha";

export interface PatientSearch {
  /** Tenant of the calling principal — needed for tenant-salted blind indexes. */
  tenantId: string;
  q?: string;
  mrn?: string;
  identifier?: { kind: IdentifierKind; value: string };
  limit: number;
  cursor?: { beforeCreatedAt: Date; beforeId: string };
}

export interface PatientRepository {
  insert(ctx: DataContext, patient: Patient): Promise<void>;
  findById(ctx: DataContext, id: string): Promise<Patient | undefined>;
  search(ctx: DataContext, query: PatientSearch): Promise<Patient[]>;
  /** Optimistic concurrency (DDR-0009): "conflict" on stale version. */
  update(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: DemographicChanges,
  ): Promise<Patient | "conflict" | "missing">;
}

export const PATIENT_REPOSITORY = Symbol("PATIENT_REPOSITORY");
