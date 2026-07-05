/**
 * API-layer glue for keyset cursors (APDR-0005): translate the opaque wire
 * cursor to the db-layer keyset and derive the next cursor from a page.
 */
import { decodeCursor, encodeCursor } from "@aiims/api-contracts";
import type { Keyset } from "@aiims/db";

export function toKeyset(cursor?: string): Keyset | undefined {
  if (!cursor) return undefined;
  const payload = decodeCursor(cursor);
  if (!payload) return undefined; // malformed → first page (never an error leak)
  const at = new Date(payload.c);
  if (Number.isNaN(at.getTime())) return undefined;
  return { beforeCreatedAt: at, beforeId: payload.id };
}

export function nextCursorFrom(
  page: ReadonlyArray<{ createdAt: Date; id: string }>,
  limit: number,
): string | null {
  if (page.length < limit) return null;
  const last = page[page.length - 1];
  if (!last) return null;
  return encodeCursor({ c: last.createdAt.toISOString(), id: last.id });
}
