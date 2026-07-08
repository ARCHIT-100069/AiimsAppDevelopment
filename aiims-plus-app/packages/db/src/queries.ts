/**
 * Typed data-access helpers — the ONLY query surface exposed to applications.
 *
 * Master Plan §29 / BDR-0003: "Drizzle only in packages/db; repositories
 * return domain objects." Apps call these intention-revealing helpers with a
 * tenant-scoped transaction handle; Drizzle types stay inside this package
 * (preserves the ADR-0011 Prisma fallback).
 *
 * Every helper REQUIRES a TenantDb obtained from withTenantContext — there is
 * no context-less variant for tenant-scoped tables (DDR-0002).
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Pool } from "pg";
import { computeRowHash, GENESIS_HASH } from "./audit-hash";
import * as s from "./schema";
import type { TenantDb } from "./tenant-context";

/* ------------------------------- identity / rbac ------------------------ */

export async function findActiveUserByKeycloakSub(
  db: TenantDb,
  keycloakSub: string,
): Promise<{ id: string; displayName: string } | undefined> {
  const [row] = await db
    .select({ id: s.appUser.id, displayName: s.appUser.displayName })
    .from(s.appUser)
    .where(and(eq(s.appUser.keycloakSub, keycloakSub), eq(s.appUser.status, "active")))
    .limit(1);
  return row;
}

export async function roleCodesForUser(db: TenantDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: s.role.code })
    .from(s.userRole)
    .innerJoin(s.role, eq(s.userRole.roleId, s.role.id))
    .where(eq(s.userRole.userId, userId));
  return rows.map((r) => r.code);
}

/* ------------------------------- feature flags -------------------------- */

/** Per-tenant override wins over global default (DB Arch §5). */
export async function isFlagEnabled(db: TenantDb, key: string, tenantId: string): Promise<boolean> {
  const rows = await db
    .select({ tenantId: s.featureFlag.tenantId, enabled: s.featureFlag.enabled })
    .from(s.featureFlag)
    .where(eq(s.featureFlag.key, key));
  const override = rows.find((r) => r.tenantId === tenantId);
  if (override) return override.enabled;
  const global = rows.find((r) => r.tenantId === null);
  return global?.enabled ?? false;
}

/* ------------------------------- outbox --------------------------------- */

export interface OutboxEventRow {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
}

export async function insertOutboxEvent(
  db: TenantDb,
  row: {
    id: string;
    tenantId: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(s.outbox).values(row);
}

/** Pending events for the CURRENT tenant context, locked for this dispatcher. */
export async function claimPendingOutboxEvents(
  db: TenantDb,
  batchSize: number,
): Promise<OutboxEventRow[]> {
  return db
    .select({
      id: s.outbox.id,
      tenantId: s.outbox.tenantId,
      aggregateType: s.outbox.aggregateType,
      aggregateId: s.outbox.aggregateId,
      eventType: s.outbox.eventType,
      payload: s.outbox.payload,
      occurredAt: s.outbox.occurredAt,
    })
    .from(s.outbox)
    .where(isNull(s.outbox.dispatchedAt))
    .orderBy(asc(s.outbox.occurredAt))
    .limit(batchSize)
    .for("update", { skipLocked: true });
}

/**
 * Matches on id alone: the PK includes occurred_at only for partitioning, and
 * a JS Date (ms precision) can never equal Postgres's microsecond timestamp —
 * an equality predicate there silently updates 0 rows. UUIDv7 ids are unique
 * by generation; the partition scan is fine at Stage 0 volumes.
 */
export async function markOutboxDispatched(db: TenantDb, eventId: string): Promise<void> {
  await db
    .update(s.outbox)
    .set({ dispatchedAt: sql`now()`, dispatchAttempts: sql`${s.outbox.dispatchAttempts} + 1` })
    .where(eq(s.outbox.id, eventId));
}

/* ------------------------------- audit ---------------------------------- */

export interface AuditAppendInput {
  /** Equals the outbox event id — idempotent 1:1 projection (DDR-0007). */
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  occurredAt: Date;
  consentRef?: string;
  context: Record<string, unknown>;
}

/**
 * Append a hash-chained audit row (DDR-0007) inside the SAME business
 * transaction (BDR-0004: one tx = write + outbox + audit, atomically).
 * A per-tenant advisory xact lock serializes the chain head so concurrent
 * transactions cannot fork the chain. The chain is per tenant — the only
 * chain visible under RLS. row_hash = sha256(prev_hash ‖ canonical(row)).
 */
export async function appendAuditRow(db: TenantDb, input: AuditAppendInput): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`);
  const prev = await db
    .select({ rowHash: s.auditLog.rowHash })
    .from(s.auditLog)
    .where(eq(s.auditLog.tenantId, input.tenantId))
    .orderBy(desc(s.auditLog.occurredAt), desc(s.auditLog.id))
    .limit(1);
  const prevHash = prev[0]?.rowHash ?? GENESIS_HASH;

  // Stable, key-sorted canonicalisation so the hash is reproducible by the
  // integrity verifier regardless of jsonb key ordering (ODR-0011).
  const rowHash = computeRowHash(prevHash, {
    id: input.id,
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: input.occurredAt.toISOString(),
    consentRef: input.consentRef ?? null,
    context: input.context,
  });

  await db.insert(s.auditLog).values({
    id: input.id,
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    occurredAt: input.occurredAt,
    consentRef: input.consentRef,
    context: input.context,
    prevHash,
    rowHash,
  });
}

/* The audit-integrity reader (chain re-walk) lands with the scheduled
 * verifier in Production (ODR-0011, Stage 9) — not exported until then. */

/* ------------------------------- tenants -------------------------------- */

/** platform.tenant is the isolation root (not tenant-RLS'd); used by the dispatcher loop. */
export async function listActiveTenantIds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM platform.tenant WHERE status = 'active'",
  );
  return rows.map((r) => r.id);
}
