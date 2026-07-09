import { Module } from "@nestjs/common";
import { MeController } from "./api/me.controller";
import { MeService } from "./application/me.service";

/**
 * Patient-portal module — self-service for patients. Reads use the global
 * UnitOfWork; booking (MeService) inserts an appointment + outbox event + audit
 * in one tenant transaction, always for the token's own patient. Every route is
 * scoped to the caller's own patient under tenant RLS.
 */
@Module({
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
