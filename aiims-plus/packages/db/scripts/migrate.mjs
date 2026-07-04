import postgres from "postgres";
import { readFileSync } from "node:fs";
const url = process.env.DATABASE_URL_OWNER; // runs as aiims_migrator/owner (DDR 0003)
if (!url) { console.error("DATABASE_URL_OWNER required"); process.exit(1); }
const sql = postgres(url);
const ddl = readFileSync(new URL("../src/migrations/0000_init.sql", import.meta.url), "utf8");
await sql.unsafe(ddl);
console.log("migration 0000_init applied");
await sql.end();
