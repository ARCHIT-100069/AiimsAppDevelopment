import { AsyncLocalStorage } from "node:async_hooks";
import type { Sql } from "postgres";
export const als = new AsyncLocalStorage<{ tx: Sql }>();
export function tx(): Sql {
  const s = als.getStore();
  if (!s) throw new Error("no tenant transaction in scope (tenant-context missing)");
  return s.tx;
}
