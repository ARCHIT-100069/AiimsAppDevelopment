/**
 * Audit hash-chain canonicalisation (ADR-0005 / ODR-0011). Shared by the writer
 * (appendAuditRow) and the integrity verifier so a row's hash is reproducible
 * regardless of JSON/jsonb key ordering. `rowHash = sha256(prevHash || canonical)`
 * where `canonical` is a STABLE, recursively key-sorted JSON of the row fields.
 */
import { createHash } from "node:crypto";

/** Hash bytes — the wide Buffer variant so digest() and alloc() unify. */
export type HashBytes = Buffer<ArrayBufferLike>;

export interface AuditHashFields {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  /** ISO-8601 instant (writer passes occurredAt.toISOString()). */
  occurredAt: string;
  consentRef: string | null;
  context: Record<string, unknown>;
}

/** Deterministic JSON: object keys sorted recursively (order-independent). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${entries.join(",")}}`;
}

export function canonicalAudit(fields: AuditHashFields): string {
  return stableStringify({
    id: fields.id,
    tenantId: fields.tenantId,
    actorId: fields.actorId,
    action: fields.action,
    resourceType: fields.resourceType,
    resourceId: fields.resourceId,
    occurredAt: fields.occurredAt,
    consentRef: fields.consentRef ?? null,
    context: fields.context,
  });
}

/** rowHash = sha256(prevHash || canonical). */
export function computeRowHash(prevHash: Uint8Array, fields: AuditHashFields): HashBytes {
  return createHash("sha256").update(prevHash).update(canonicalAudit(fields)).digest();
}

export const GENESIS_HASH: HashBytes = Buffer.alloc(32);
