/**
 * SQL migration runner (DDR-0011).
 *
 * Applies src/migrations/*.sql in lexical order, once each, recording
 * applications in platform.schema_migrations. Runs as the migrator/owner
 * connection (DATABASE_URL_MIGRATOR) — never as aiims_app.
 *
 * ${PLACEHOLDER} tokens are substituted from the environment so role
 * passwords never live in committed SQL (SDR-0006); the defaults below are
 * for LOCAL DEV ONLY.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = join(__dirname, "..", "src", "migrations");

/** Local-dev defaults; deployed environments must set these explicitly. */
const SUBSTITUTIONS: Record<string, string> = {
  AIIMS_APP_PASSWORD: process.env.AIIMS_APP_PASSWORD ?? "aiims_app_dev_pw",
  AIIMS_MIGRATOR_PASSWORD: process.env.AIIMS_MIGRATOR_PASSWORD ?? "aiims_migrator_dev_pw",
  AIIMS_READONLY_PASSWORD: process.env.AIIMS_READONLY_PASSWORD ?? "aiims_readonly_dev_pw",
};

function render(sqlText: string, databaseName: string): string {
  let out = sqlText.replaceAll("${DATABASE_NAME}", databaseName);
  for (const [key, value] of Object.entries(SUBSTITUTIONS)) {
    out = out.replaceAll(`\${${key}}`, value);
  }
  return out;
}

export async function migrate(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
    await client.query("CREATE SCHEMA IF NOT EXISTS platform");
    await client.query(
      `CREATE TABLE IF NOT EXISTS platform.schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rowCount } = await client.query(
        "SELECT 1 FROM platform.schema_migrations WHERE name = $1",
        [file],
      );
      if (rowCount) continue;

      const sqlText = render(readFileSync(join(MIGRATIONS_DIR, file), "utf8"), databaseName);
      await client.query("BEGIN");
      try {
        await client.query(sqlText);
        await client.query("INSERT INTO platform.schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

/* CLI entrypoint: pnpm --filter @aiims/db migrate */
if (require.main === module) {
  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL_OWNER;
  if (!url) {
    process.stderr.write("DATABASE_URL_MIGRATOR is required (migrations never run as aiims_app)\n");
    process.exit(1);
  }
  migrate(url)
    .then((applied) => {
      process.stdout.write(applied.length ? `applied: ${applied.join(", ")}\n` : "up to date\n");
    })
    .catch((err) => {
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    });
}
