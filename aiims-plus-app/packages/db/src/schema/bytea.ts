import { customType } from "drizzle-orm/pg-core";

/** Postgres bytea (hash-chain columns) — drizzle has no built-in bytea type. */
export const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return "bytea";
  },
});
