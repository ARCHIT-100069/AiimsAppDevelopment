/**
 * Dev/test seed — SYNTHETIC data only, never PHI (TDR-0013).
 *
 * Seeds two tenants (A/B) so cross-tenant isolation is exercisable from the
 * first minute (TDR-0006 fixtures), roles per tenant, app_users mapped to the
 * Keycloak dev-realm subjects (docker/keycloak/realm-aiims.json uses the SAME
 * fixed ids), and global feature flags defaulting every adapter to its mock
 * (ADR-0010).
 *
 * Runs as the migrator connection. RLS-scoped inserts set the tenant context
 * explicitly per tenant — the documented migration bypass context (DDR-0002).
 */
import { Client } from "pg";
import { newId } from "./ids";
import { seedReference } from "./seed-reference";

/** Fixed fixture ids — shared with the Keycloak realm export and tests. */
export const SEED = {
  tenantA: "0197a000-0000-7000-8000-00000000000a",
  tenantB: "0197a000-0000-7000-8000-00000000000b",
  /** Keycloak user ids (= token `sub`) from realm-aiims.json. */
  keycloak: {
    doctorA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    adminA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    frontdeskA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    doctorB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  },
} as const;

const ROLES = ["admin", "doctor", "nurse", "front_desk"] as const;

const ADAPTER_FLAGS = [
  "adapter.abdm.mock",
  "adapter.consent.mock",
  "adapter.payment.mock",
  "adapter.notification.mock",
  "adapter.ai.mock",
] as const;

interface SeedUser {
  keycloakSub: string;
  displayName: string;
  roleCode: (typeof ROLES)[number];
}

async function seedTenant(
  client: Client,
  tenantId: string,
  slug: string,
  name: string,
  users: SeedUser[],
): Promise<void> {
  await client.query(
    `INSERT INTO platform.tenant (id, slug, name) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO NOTHING`,
    [tenantId, slug, name],
  );

  // Tenant-scoped inserts run under that tenant's context (FORCE RLS applies
  // to the owner too — DDR-0002 trade-off).
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

  const roleIds = new Map<string, string>();
  for (const code of ROLES) {
    const id = newId();
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO platform.role (id, tenant_id, code, name)
       VALUES ($1, $2, $3, initcap(replace($3, '_', ' ')))
       ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [id, tenantId, code],
    );
    roleIds.set(code, rows[0]!.id);
  }

  for (const user of users) {
    const userId = newId();
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO platform.app_user (id, tenant_id, keycloak_sub, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (keycloak_sub) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [userId, tenantId, user.keycloakSub, user.displayName],
    );
    await client.query(
      `INSERT INTO platform.user_role (tenant_id, user_id, role_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [tenantId, rows[0]!.id, roleIds.get(user.roleCode)],
    );
  }
  await client.query("COMMIT");
}

export async function seed(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await seedTenant(client, SEED.tenantA, "demo-hospital-a", "Demo Hospital A (synthetic)", [
      { keycloakSub: SEED.keycloak.doctorA, displayName: "Dr. Asha Demo", roleCode: "doctor" },
      { keycloakSub: SEED.keycloak.adminA, displayName: "Admin Demo", roleCode: "admin" },
      {
        keycloakSub: SEED.keycloak.frontdeskA,
        displayName: "Frontdesk Demo",
        roleCode: "front_desk",
      },
    ]);
    await seedTenant(client, SEED.tenantB, "demo-clinic-b", "Demo Clinic B (synthetic)", [
      { keycloakSub: SEED.keycloak.doctorB, displayName: "Dr. Bala Demo", roleCode: "doctor" },
    ]);

    // Reference code systems: minimal dev set, replaceable by real imports (DDR-0012).
    await seedReference(client);

    // Global feature flags: every adapter defaults to MOCK (ADR-0010).
    for (const key of ADAPTER_FLAGS) {
      await client.query(
        `INSERT INTO platform.feature_flag (id, tenant_id, key, enabled)
         VALUES ($1, NULL, $2, true)
         ON CONFLICT (tenant_id, key) DO NOTHING`,
        [newId(), key],
      );
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL_OWNER;
  if (!url) {
    process.stderr.write("DATABASE_URL_MIGRATOR is required\n");
    process.exit(1);
  }
  seed(url)
    .then(() => process.stdout.write("seeded synthetic dev tenants A/B (no PHI — TDR-0013)\n"))
    .catch((err) => {
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(1);
    });
}
