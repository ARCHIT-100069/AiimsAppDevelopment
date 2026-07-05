/**
 * Platform module — the cross-cutting foundations every domain module builds
 * on (Blueprint §7): config, logging, UoW/tenant-context, event bus, outbox
 * dispatcher, audit, feature flags. Global so the pipeline cannot be skipped.
 */
import { Global, Module } from "@nestjs/common";
import { loadConfig } from "@aiims/config";
import { AuditService } from "./audit.service";
import { CryptoService } from "./crypto.provider";
import { CONFIG } from "./config.provider";
import { UnitOfWork } from "./db.provider";
import { EventBus } from "./event-bus";
import { FeatureFlagService } from "./feature-flag.service";
import { createLogger, LOGGER } from "./logger";
import { OutboxDispatcher } from "./outbox.dispatcher";

@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    {
      provide: LOGGER,
      inject: [CONFIG],
      useFactory: (config: ReturnType<typeof loadConfig>) => createLogger(config.LOG_LEVEL),
    },
    UnitOfWork,
    EventBus,
    OutboxDispatcher,
    AuditService,
    FeatureFlagService,
    CryptoService,
  ],
  exports: [CONFIG, LOGGER, UnitOfWork, EventBus, AuditService, FeatureFlagService, CryptoService],
})
export class PlatformModule {}
