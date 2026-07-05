import { Module } from "@nestjs/common";
import { IdentityController } from "./api/identity.controller";
import { OrgStructureController } from "./api/org-structure.controller";
import { IdentityService } from "./application/identity.service";
import { OrgStructureService } from "./application/org-structure.service";

/**
 * Core Platform directory (Stage 1, Master Plan §11): organization →
 * facility → department, plus app users and role assignment — the shared
 * platform domain every clinical stage builds on.
 */
@Module({
  controllers: [OrgStructureController, IdentityController],
  providers: [OrgStructureService, IdentityService],
})
export class OrganizationModule {}
