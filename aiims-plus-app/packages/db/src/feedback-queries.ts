/**
 * Patient-feedback data-access helpers (NABH/quality). Drizzle stays confined
 * here (ADR-0011). Every helper requires a tenant-scoped transaction
 * (DDR-0002). Feedback is append-only — insert + list only.
 */
import { and, desc, eq } from "drizzle-orm";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

export interface FeedbackRow {
  id: string;
  patientId: string;
  encounterId: string | null;
  rating: number;
  category: string | null;
  comment: string | null;
  createdAt: Date;
}
const feedbackCols = {
  id: s.patientFeedback.id,
  patientId: s.patientFeedback.patientId,
  encounterId: s.patientFeedback.encounterId,
  rating: s.patientFeedback.rating,
  category: s.patientFeedback.category,
  comment: s.patientFeedback.comment,
  createdAt: s.patientFeedback.createdAt,
};

export interface InsertFeedbackInput {
  id: string;
  tenantId: string;
  patientId: string;
  encounterId?: string | null;
  rating: number;
  category?: string | null;
  comment?: string | null;
}
export async function insertFeedback(
  db: TenantDb,
  input: InsertFeedbackInput,
): Promise<FeedbackRow> {
  const [row] = await db
    .insert(s.patientFeedback)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      rating: input.rating,
      category: input.category ?? null,
      comment: input.comment ?? null,
    })
    .returning(feedbackCols);
  if (!row) throw new Error("feedback insert returned no row");
  return row;
}

/** All feedback for the tenant, newest first (staff/quality view). */
export async function listFeedback(db: TenantDb, limit = 100): Promise<FeedbackRow[]> {
  return db
    .select(feedbackCols)
    .from(s.patientFeedback)
    .orderBy(desc(s.patientFeedback.createdAt))
    .limit(limit);
}

/** A single patient's own feedback history (portal view). */
export async function listFeedbackByPatient(
  db: TenantDb,
  patientId: string,
): Promise<FeedbackRow[]> {
  return db
    .select(feedbackCols)
    .from(s.patientFeedback)
    .where(and(eq(s.patientFeedback.patientId, patientId)))
    .orderBy(desc(s.patientFeedback.createdAt));
}
