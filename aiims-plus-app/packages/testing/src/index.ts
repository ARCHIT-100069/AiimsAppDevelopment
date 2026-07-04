/**
 * @aiims/testing — integration-test harness (TDR-0003) + fixtures for the
 * cross-tenant isolation gate (TDR-0006).
 *
 * Spins up a REAL PostgreSQL (Testcontainers), applies the reviewed
 * migrations, seeds the synthetic A/B tenants (TDR-0013), and hands back
 * connection URLs for each database role. CI can inject an existing server
 * via ISOLATION_DATABASE_URL (service container) — same code path either way.
 */
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { migrate, seed } from "@aiims/db";

export interface IsolationEnv {
  /** Superuser/migrator connection — migrations & fixture surgery only. */
  readonly migratorUrl: string;
  /** The `aiims_app` connection — what production code uses (FORCE RLS applies). */
  readonly appUrl: string;
  stop(): Promise<void>;
}

const APP_PASSWORD = process.env.AIIMS_APP_PASSWORD ?? "aiims_app_dev_pw";

function withCredentials(baseUrl: string, user: string, password: string): string {
  const url = new URL(baseUrl);
  url.username = user;
  url.password = password;
  return url.toString();
}

export async function setupIsolationEnv(): Promise<IsolationEnv> {
  let migratorUrl = process.env.ISOLATION_DATABASE_URL;
  let container: StartedTestContainer | undefined;

  if (!migratorUrl) {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "postgres", POSTGRES_DB: "aiims" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    migratorUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getMappedPort(5432)}/aiims`;
  }

  await migrate(migratorUrl);
  await seed(migratorUrl);

  return {
    migratorUrl,
    appUrl: withCredentials(migratorUrl, "aiims_app", APP_PASSWORD),
    stop: async () => {
      await container?.stop();
    },
  };
}
