/**
 * RLS policy-diff gate (DDR-0011 / ADR-0011 guardrail #2).
 *
 * Fails (exit 1) if any table in rls-policies.json is missing its policy,
 * lost ENABLE/FORCE ROW LEVEL SECURITY, or if an unexpected tenant policy
 * appears. This is the CI tripwire against drizzle-kit (or anyone) silently
 * dropping a policy — a PHI-breach class regression (Security risk S-4).
 */
import { Client } from "pg";
import manifest from "./rls-policies.json";

interface PolicyRow {
  schemaname: string;
  tablename: string;
  policyname: string;
}

export async function checkRlsPolicies(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const problems: string[] = [];
  try {
    const { rows: policies } = await client.query<PolicyRow>(
      "SELECT schemaname, tablename, policyname FROM pg_policies",
    );
    const { rows: rlsState } = await client.query<{
      schemaname: string;
      tablename: string;
      rls_enabled: boolean;
      rls_forced: boolean;
    }>(
      `SELECT n.nspname AS schemaname, c.relname AS tablename,
              c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p')`,
    );

    for (const expected of manifest.policies) {
      const hasPolicy = policies.some(
        (p) =>
          p.schemaname === expected.schema &&
          p.tablename === expected.table &&
          p.policyname === expected.policy,
      );
      if (!hasPolicy) {
        problems.push(`MISSING POLICY: ${expected.schema}.${expected.table} "${expected.policy}"`);
      }
      const state = rlsState.find(
        (s) => s.schemaname === expected.schema && s.tablename === expected.table,
      );
      if (!state) {
        problems.push(`MISSING TABLE: ${expected.schema}.${expected.table}`);
      } else {
        if (!state.rls_enabled)
          problems.push(`RLS NOT ENABLED: ${expected.schema}.${expected.table}`);
        if (!state.rls_forced)
          problems.push(`RLS NOT FORCED: ${expected.schema}.${expected.table}`);
      }
    }

    // Unexpected policies are also a review event (could mask a rename/drop).
    for (const p of policies) {
      const known = manifest.policies.some(
        (e) => e.schema === p.schemaname && e.table === p.tablename && e.policy === p.policyname,
      );
      if (!known && (p.schemaname === "platform" || p.schemaname === "audit")) {
        problems.push(
          `UNEXPECTED POLICY (add to manifest via security review): ${p.schemaname}.${p.tablename} "${p.policyname}"`,
        );
      }
    }
  } finally {
    await client.end();
  }
  return problems;
}

if (require.main === module) {
  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL_OWNER;
  if (!url) {
    process.stderr.write("DATABASE_URL_MIGRATOR is required\n");
    process.exit(1);
  }
  checkRlsPolicies(url)
    .then((problems) => {
      if (problems.length) {
        process.stderr.write(
          `RLS POLICY GATE FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`,
        );
        process.exit(1);
      }
      process.stdout.write("RLS policy gate: all policies present, enabled, and FORCED\n");
    })
    .catch((err) => {
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    });
}
