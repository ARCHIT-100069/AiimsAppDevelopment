/**
 * Composition root. The guard order is the FIXED pipeline (BDR-0012):
 * AuthN → AuthZ (tenant context is opened per use-case by the application
 * service's Unit of Work — BDR-0004); the global filter maps every error to
 * Problem Details. No endpoint can opt out.
 */
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AdaptersModule } from "./adapters/adapters.module";
import { HealthController } from "./platform/health.controller";
import { ProblemFilter } from "./platform/problem.filter";
import { NoteModule } from "./modules/note/note.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { ReferenceModule } from "./modules/reference/reference.module";
import { TenancyModule } from "./modules/tenancy/tenancy.module";
import { AuthGuard } from "./platform/auth.guard";
import { AuthzGuard } from "./platform/authz.guard";
import { PlatformModule } from "./platform/platform.module";

@Module({
  imports: [
    PlatformModule,
    AdaptersModule,
    NoteModule,
    TenancyModule,
    OrganizationModule,
    ReferenceModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard }, // 1. AuthN (SDR-0001)
    { provide: APP_GUARD, useClass: AuthzGuard }, // 2. AuthZ PEP (SDR-0002)
    { provide: APP_FILTER, useClass: ProblemFilter }, // errors → RFC 9457 (APDR-0003)
  ],
})
export class AppModule {}
