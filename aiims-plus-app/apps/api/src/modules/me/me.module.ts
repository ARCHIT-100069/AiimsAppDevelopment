import { Module } from "@nestjs/common";
import { MeController } from "./api/me.controller";

/**
 * Patient-portal module — read-only self-service for patients. Uses the global
 * UnitOfWork; adds no providers of its own. Every route is scoped to the token's
 * own patient under tenant RLS (see MeController).
 */
@Module({
  controllers: [MeController],
})
export class MeModule {}
