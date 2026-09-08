/**
 * Repository port (BDR-0003) — domain-owned, returns domain objects.
 * `DataContext` stays opaque (the tenant-scoped transaction).
 */
import type { Practitioner, PractitionerChanges } from "../domain/practitioner";

export type DataContext = unknown;

export interface PractitionerSearch {
  q?: string;
  registrationNo?: string;
  departmentId?: string;
  /** Restrict to practitioners whose linked login holds this role (e.g.
   *  "doctor" — for booking pickers, where nurses/front-desk must not
   *  appear alongside physicians). */
  role?: string;
  limit: number;
  cursor?: { beforeCreatedAt: Date; beforeId: string };
}

export interface PractitionerRepository {
  insert(ctx: DataContext, practitioner: Practitioner): Promise<void>;
  findById(ctx: DataContext, id: string): Promise<Practitioner | undefined>;
  search(ctx: DataContext, query: PractitionerSearch): Promise<Practitioner[]>;
  update(
    ctx: DataContext,
    id: string,
    expectedVersion: number,
    changes: PractitionerChanges,
  ): Promise<Practitioner | "conflict" | "missing">;
  /** Role codes of an app_user — for the clinical-role advisory check (decision i). */
  appUserRoleCodes(ctx: DataContext, appUserId: string): Promise<string[]>;
  /** Linked user's display name — defaults the practitioner name (decision c). */
  appUserDisplayName(ctx: DataContext, appUserId: string): Promise<string | undefined>;
}

export const PRACTITIONER_REPOSITORY = Symbol("PRACTITIONER_REPOSITORY");
