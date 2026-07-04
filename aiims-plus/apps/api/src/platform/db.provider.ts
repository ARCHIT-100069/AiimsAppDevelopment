import postgres from "postgres";
import { loadConfig } from "@aiims/config";
const cfg = loadConfig();
// Single app pool; connects as aiims_app (no BYPASSRLS). Tenant context set per-tx (DDR 0002).
export const sql = postgres(cfg.DATABASE_URL_APP, { max: 10 });
export const DB = Symbol("DB");
