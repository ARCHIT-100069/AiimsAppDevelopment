/**
 * Cursor pagination (APDR-0005): opaque keyset cursor over (createdAt, id),
 * stable under inserts. The cursor is base64url JSON — clients treat it as
 * opaque and never construct it.
 */
import { z } from "zod";

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface CursorPayload {
  /** ISO timestamp of the last row's createdAt. */
  c: string;
  /** Last row's id (tiebreaker). */
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    // id is usually a uuid but reference codes use natural keys — opaque string.
    const shape = z.object({ c: z.string().min(1), id: z.string().min(1) });
    return shape.parse(parsed);
  } catch {
    return undefined; // malformed cursor → treated as first page, never an error leak
  }
}

export const listMetaSchema = z.object({ nextCursor: z.string().nullable() });
