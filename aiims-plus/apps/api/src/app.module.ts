import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { NoteModule } from "./modules/note/note.module.js";
import { HealthController } from "./common/health.controller.js";
import { TenantContextInterceptor } from "./platform/tenant-context.interceptor.js";
import { ProblemFilter } from "./common/problem.filter.js";
@Module({
  imports: [NoteModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_FILTER, useClass: ProblemFilter },
  ],
})
export class AppModule {}
