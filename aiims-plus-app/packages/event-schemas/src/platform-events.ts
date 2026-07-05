/**
 * Core Platform domain events (Stage 1) — versioned outbox payloads
 * (DDR-0007/BDR-0005). References and codes only; never names, addresses,
 * or other personal fields (SDR-0004).
 */
import { uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

export const TENANT_CREATED_V1 = "tenant.created.v1" as const;
export const tenantCreatedV1PayloadSchema = z.object({
  tenantId: uuidSchema,
  slug: z.string(),
});

export const ORGANIZATION_CREATED_V1 = "organization.created.v1" as const;
export const organizationCreatedV1PayloadSchema = z.object({
  organizationId: uuidSchema,
});

export const FACILITY_CREATED_V1 = "facility.created.v1" as const;
export const facilityCreatedV1PayloadSchema = z.object({
  facilityId: uuidSchema,
  organizationId: uuidSchema,
});

export const DEPARTMENT_CREATED_V1 = "department.created.v1" as const;
export const departmentCreatedV1PayloadSchema = z.object({
  departmentId: uuidSchema,
  facilityId: uuidSchema,
  code: z.string(),
});

export const USER_CREATED_V1 = "user.created.v1" as const;
export const userCreatedV1PayloadSchema = z.object({
  userId: uuidSchema,
});

export const USER_ROLE_ASSIGNED_V1 = "user.role_assigned.v1" as const;
export const userRoleAssignedV1PayloadSchema = z.object({
  userId: uuidSchema,
  roleCode: z.string(),
  departmentId: uuidSchema.optional(),
});

export const PLATFORM_EVENT_SCHEMAS: Record<string, z.ZodType> = {
  [TENANT_CREATED_V1]: tenantCreatedV1PayloadSchema,
  [ORGANIZATION_CREATED_V1]: organizationCreatedV1PayloadSchema,
  [FACILITY_CREATED_V1]: facilityCreatedV1PayloadSchema,
  [DEPARTMENT_CREATED_V1]: departmentCreatedV1PayloadSchema,
  [USER_CREATED_V1]: userCreatedV1PayloadSchema,
  [USER_ROLE_ASSIGNED_V1]: userRoleAssignedV1PayloadSchema,
};
