import "./platform/tracing"; // FIRST: OTel patches modules before they load (IDR-0013)
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { loadConfig } from "@aiims/config";
import { AppModule } from "./app.module";
import { createLogger } from "./platform/logger";
import { requestContextMiddleware } from "./platform/request-context";
import { securityHeadersMiddleware } from "./platform/security-headers";

async function bootstrap(): Promise<void> {
  // Fail fast on invalid configuration BEFORE Nest builds the graph (BDR-0011).
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);

  const app = await NestFactory.create(AppModule, { logger: false });
  app.use(securityHeadersMiddleware); // baseline hardening headers on every response (Stage 9)
  app.use(requestContextMiddleware); // correlation id on every request (APDR-0003)
  app.enableShutdownHooks();

  await app.listen(config.PORT);
  logger.info({ port: config.PORT, env: config.NODE_ENV }, "aiims-api listening");
}

bootstrap().catch((err: unknown) => {
  // Boot failures must be loud and unambiguous (fail-fast, BDR-0011).
  process.stderr.write(`FATAL: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
