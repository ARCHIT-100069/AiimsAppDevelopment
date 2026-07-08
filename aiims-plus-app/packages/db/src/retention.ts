/**
 * Retention-policy engine + crypto-shredding (ADR-0009).
 *
 * The ENGINEERING is finalized; the DURATIONS are deferred for legal
 * validation, so this module NEVER hard-codes a retention period. It reads a
 * policy from configuration; with no policy configured it is INERT (it will
 * not stamp schedules and will not shred). This keeps DPDP erasure faithful to
 * the medical-record retention minimums that counsel still has to set.
 *
 * Crypto-shred = destroy the per-record wrapped key (clinical.patient.enc_key_ref,
 * the ADR-0010 KeyProvider seam). Once the wrapped data-key is gone the
 * AES-GCM ciphertext (abha/phone/email) is unrecoverable — erasure without
 * racing a physical DELETE, which preserves referential + audit integrity.
 * The blind indexes are cleared too so a shredded subject can no longer be
 * matched. The row remains (audit/consent linkage intact) with enc_key_ref
 * NULL as the "already shredded" marker.
 *
 * Every shred is written to the hash-chained audit log (ADR-0005) inside the
 * same transaction, so the erasure is itself tamper-evident.
 */
import { and, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { createAppPool } from "./client";
import { newId } from "./ids";
import { appendAuditRow } from "./queries";
import * as s from "./schema";
import { withTenantContext, type TenantDb } from "./tenant-context";

/** A single record-class rule. Durations come from config — never hard-coded. */
export interface RetentionRule {
  /** matches clinical.*.retention_class */
  retentionClass: string;
  /** retention window in days from record creation (legal minimum). */
  durationDays: number;
  /** e.g. "clinical-establishment-rules" — provenance for audit/DPIA. */
  legalBasis: string;
}

export interface RetentionPolicy {
  rules: RetentionRule[];
}

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

/**
 * Load the retention policy from configuration (RETENTION_POLICY_JSON — inline
 * JSON). Returns `null` when unconfigured, which keeps the engine INERT: the
 * legal durations are deferred (ADR-0009), so absent an explicit policy we
 * must not shred anything.
 */
export function loadRetentionPolicy(env: NodeJS.ProcessEnv = process.env): RetentionPolicy | null {
  const raw = env.RETENTION_POLICY_JSON;
  if (!raw || raw.trim() === "") return null;
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as RetentionPolicy).rules)
  ) {
    throw new Error("RETENTION_POLICY_JSON must be an object with a 'rules' array");
  }
  const rules = (parsed as RetentionPolicy).rules;
  for (const r of rules) {
    if (
      typeof r.retentionClass !== "string" ||
      typeof r.durationDays !== "number" ||
      r.durationDays < 0
    ) {
      throw new Error(`Invalid retention rule: ${JSON.stringify(r)}`);
    }
    if (typeof r.legalBasis !== "string" || r.legalBasis === "") {
      throw new Error(`Retention rule for '${r.retentionClass}' is missing a legalBasis`);
    }
  }
  return { rules };
}

/** Pure helper: the retention_until for a record, or null if its class is unknown. */
export function retentionUntilFor(
  policy: RetentionPolicy,
  retentionClass: string | null,
  createdAt: Date,
): Date | null {
  if (!retentionClass) return null;
  const rule = policy.rules.find((r) => r.retentionClass === retentionClass);
  if (!rule) return null;
  return new Date(createdAt.getTime() + rule.durationDays * 86_400_000);
}

/**
 * Stamp retention_until on patient rows that have a known retention_class but
 * no schedule yet. Idempotent; returns the number of rows stamped for a tenant.
 * Runs inside the caller's tenant transaction.
 */
export async function applyRetentionSchedule(
  db: TenantDb,
  tenantId: string,
  policy: RetentionPolicy,
): Promise<number> {
  const rows = await db
    .select({
      id: s.patient.id,
      retentionClass: s.patient.retentionClass,
      createdAt: s.patient.createdAt,
    })
    .from(s.patient)
    .where(
      and(
        eq(s.patient.tenantId, tenantId),
        isNotNull(s.patient.retentionClass),
        isNull(s.patient.retentionUntil),
      ),
    );
  let stamped = 0;
  for (const r of rows) {
    const until = retentionUntilFor(policy, r.retentionClass, r.createdAt);
    if (!until) continue;
    await db
      .update(s.patient)
      .set({ retentionUntil: until })
      .where(and(eq(s.patient.tenantId, tenantId), eq(s.patient.id, r.id)));
    stamped++;
  }
  return stamped;
}

export interface ShredResult {
  tenantId: string;
  scheduled: number;
  shredded: string[];
}

/**
 * Crypto-shred every patient whose retention window has expired: destroy the
 * wrapped data-key + ciphertext + blind indexes, bump the optimistic-lock
 * version, and append a tamper-evident audit row — all in one transaction per
 * tenant. `enc_key_ref IS NOT NULL` is the not-yet-shredded guard, so re-runs
 * are idempotent.
 */
export async function cryptoShredExpiredPatients(
  db: TenantDb,
  tenantId: string,
  opts: { now?: Date; actorId?: string } = {},
): Promise<string[]> {
  const now = opts.now ?? new Date();
  const actorId = opts.actorId ?? SYSTEM_ACTOR;

  const candidates = await db
    .select({ id: s.patient.id, retentionUntil: s.patient.retentionUntil })
    .from(s.patient)
    .where(
      and(
        eq(s.patient.tenantId, tenantId),
        isNotNull(s.patient.encKeyRef),
        isNotNull(s.patient.retentionUntil),
        lte(s.patient.retentionUntil, now),
      ),
    );

  const shredded: string[] = [];
  for (const c of candidates) {
    await db
      .update(s.patient)
      .set({
        encKeyRef: null,
        abhaNumberEnc: null,
        abhaNumberBidx: null,
        phoneEnc: null,
        phoneBidx: null,
        emailEnc: null,
        emailBidx: null,
        version: sql`${s.patient.version} + 1`,
        updatedAt: now,
      })
      .where(and(eq(s.patient.tenantId, tenantId), eq(s.patient.id, c.id)));

    await appendAuditRow(db, {
      id: newId(),
      tenantId,
      actorId,
      action: "patient.crypto_shredded",
      resourceType: "patient",
      resourceId: c.id,
      occurredAt: now,
      context: {
        reason: "retention_expired",
        retentionUntil: c.retentionUntil?.toISOString() ?? null,
        method: "destroy_wrapped_key",
      },
    });
    shredded.push(c.id);
  }
  return shredded;
}

/** All tenant ids (owner/migrator read) so the sweep can iterate every tenant. */
async function allTenantIds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM platform.tenant ORDER BY id");
  return rows.map((r) => r.id);
}

/**
 * Full sweep across every tenant: stamp schedules, then crypto-shred expired
 * records. Each tenant runs in its own transaction under its tenant context so
 * RLS holds and the audit chain stays per-tenant consistent.
 */
export async function runRetentionSweep(
  pool: Pool,
  policy: RetentionPolicy,
  opts: { now?: Date; actorId?: string } = {},
): Promise<ShredResult[]> {
  const tenantIds = await allTenantIds(pool);
  const results: ShredResult[] = [];
  for (const tenantId of tenantIds) {
    const result = await withTenantContext(
      pool,
      { tenantId, actorId: opts.actorId ?? SYSTEM_ACTOR },
      async (db) => {
        const scheduled = await applyRetentionSchedule(db, tenantId, policy);
        const shredded = await cryptoShredExpiredPatients(db, tenantId, opts);
        return { tenantId, scheduled, shredded } satisfies ShredResult;
      },
    );
    results.push(result);
  }
  return results;
}

/* CLI (`pnpm --filter @aiims/db retention:sweep`). Inert with no policy. */
if (require.main === module) {
  const policy = loadRetentionPolicy();
  if (!policy) {
    process.stdout.write(
      "retention sweep: no RETENTION_POLICY_JSON configured — engine INERT " +
        "(ADR-0009 durations deferred for legal validation; nothing shredded)\n",
    );
    process.exit(0);
  }
  const url = process.env.DATABASE_URL_APP;
  if (!url) {
    process.stderr.write("retention-sweep: DATABASE_URL_APP is required\n");
    process.exit(2);
  }
  const pool = createAppPool(url);
  runRetentionSweep(pool, policy)
    .then((results) => {
      const totalShredded = results.reduce((n, r) => n + r.shredded.length, 0);
      const totalScheduled = results.reduce((n, r) => n + r.scheduled, 0);
      process.stdout.write(
        `retention sweep complete: ${totalScheduled} scheduled, ${totalShredded} crypto-shredded ` +
          `across ${results.length} tenant(s)\n`,
      );
      for (const r of results) {
        if (r.scheduled || r.shredded.length) {
          process.stdout.write(
            `  tenant ${r.tenantId}: +${r.scheduled} scheduled, shredded [${r.shredded.join(", ")}]\n`,
          );
        }
      }
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      process.stderr.write(`retention-sweep error: ${(err as Error).message}\n`);
      void pool.end();
      process.exit(1);
    });
}
