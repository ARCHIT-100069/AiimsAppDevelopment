/**
 * The single source of entity ids (DDR-0001): UUIDv7, application-generated —
 * time-ordered (index-friendly), non-enumerable, available before INSERT so
 * the outbox event can be correlated in the same transaction. Switch to
 * Postgres-native uuidv7() only when Aurora GAs PostgreSQL 18.
 */
import { v7 as uuidv7 } from "uuid";

export function newId(): string {
  return uuidv7();
}
