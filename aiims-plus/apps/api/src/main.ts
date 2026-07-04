import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { VersioningType } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { loadConfig } from "@aiims/config";

async function bootstrap() {
  const cfg = loadConfig(); // fail-fast on invalid config (BDR-0011)
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.listen(cfg.PORT, "0.0.0.0");
  // structured, no-PHI startup log
  console.log(JSON.stringify({ level: "info", msg: "aiims-api up", port: cfg.PORT, env: cfg.NODE_ENV }));
}
bootstrap();
