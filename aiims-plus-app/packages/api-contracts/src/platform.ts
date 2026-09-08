/**
 * Core Platform contracts (Stage 1, Master Plan §11) — the ONLY shapes the
 * API exposes. Database entities never cross this boundary (founder
 * clarification #1); controllers map domain objects → these DTOs.
 */
import { isoTimestampSchema, ROLE_CODES, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";
import { listMetaSchema } from "./pagination";

/* --------------------------------- tenancy ------------------------------ */

const slugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits, hyphens");

/**
 * Platform-admin operation. Supplying `id` makes creation IDEMPOTENT
 * (duplicate-safe, clarification #3): replaying the same id+slug returns the
 * existing tenant instead of erroring — and lets identity fixtures reference
 * a tenant id before it exists.
 */
export const createTenantRequestSchema = z.object({
  id: uuidSchema.optional(),
  slug: slugSchema,
  name: z.string().min(1).max(200),
  /** Bootstrap admin: maps an EXISTING Keycloak subject (provisioning automation is Production work). */
  initialAdmin: z
    .object({
      keycloakSub: uuidSchema,
      displayName: z.string().min(1).max(200),
    })
    .optional(),
});
export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;

export const tenantResponseSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string(),
  status: z.enum(["active", "suspended"]),
  createdAt: isoTimestampSchema,
});
export type TenantResponse = z.infer<typeof tenantResponseSchema>;

/* ------------------------------ organization ---------------------------- */

export const createOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["hospital", "clinic", "chain"]),
});
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const organizationResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: z.enum(["hospital", "clinic", "chain"]),
  createdAt: isoTimestampSchema,
});
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

export const createFacilityRequestSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(200),
  /** IANA timezone (DB Arch §5); India default applied server-side. */
  timezone: z.string().min(1).max(64).default("Asia/Kolkata"),
  address: z.record(z.string(), z.unknown()).optional(),
});
export type CreateFacilityRequest = z.infer<typeof createFacilityRequestSchema>;

export const facilityResponseSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string(),
  timezone: z.string(),
  createdAt: isoTimestampSchema,
});
export type FacilityResponse = z.infer<typeof facilityResponseSchema>;

export const createDepartmentRequestSchema = z.object({
  facilityId: uuidSchema,
  name: z.string().min(1).max(200),
  code: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, "uppercase code, e.g. OPD-GEN"),
});
export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;

export const departmentResponseSchema = z.object({
  id: uuidSchema,
  facilityId: uuidSchema,
  name: z.string(),
  code: z.string(),
  createdAt: isoTimestampSchema,
});
export type DepartmentResponse = z.infer<typeof departmentResponseSchema>;

/* --------------------------------- identity ----------------------------- */

export const createUserRequestSchema = z.object({
  /** An EXISTING Keycloak subject; Keycloak Admin-API provisioning is deferred (ADR-0010). */
  keycloakSub: uuidSchema,
  displayName: z.string().min(1).max(200),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const userResponseSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  status: z.enum(["active", "disabled"]),
  roles: z.array(z.enum(ROLE_CODES)),
  /** Optimistic-concurrency token — echo via If-Match on PATCH (APDR-0006). */
  version: z.number().int(),
  createdAt: isoTimestampSchema,
});
export type UserResponse = z.infer<typeof userResponseSchema>;

/** Idempotent (clarification #3): re-assigning an existing role is a no-op 200. */
export const assignRoleRequestSchema = z.object({
  roleCode: z.enum(ROLE_CODES),
  departmentId: uuidSchema.optional(),
});
export type AssignRoleRequest = z.infer<typeof assignRoleRequestSchema>;

/** Deactivate/reactivate a staff login — blocks/restores session resolution. */
export const updateUserStatusRequestSchema = z.object({
  status: z.enum(["active", "disabled"]),
});
export type UpdateUserStatusRequest = z.infer<typeof updateUserStatusRequestSchema>;

/* -------------------------------- reference ----------------------------- */

export const codeSystemResponseSchema = z.object({
  code: z.string(),
  name: z.string(),
  uri: z.string(),
  release: z.string(),
});
export type CodeSystemResponse = z.infer<typeof codeSystemResponseSchema>;

export const referenceCodeResponseSchema = z.object({
  system: z.string(),
  code: z.string(),
  display: z.string(),
  active: z.boolean(),
});
export type ReferenceCodeResponse = z.infer<typeof referenceCodeResponseSchema>;

/* ------------------------------- list wrappers -------------------------- */

const list = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), meta: listMetaSchema });

export const listTenantsResponseSchema = list(tenantResponseSchema);
export const listOrganizationsResponseSchema = list(organizationResponseSchema);
export const listFacilitiesResponseSchema = list(facilityResponseSchema);
export const listDepartmentsResponseSchema = list(departmentResponseSchema);
export const listUsersResponseSchema = list(userResponseSchema);
export const listCodeSystemsResponseSchema = list(codeSystemResponseSchema);
export const listReferenceCodesResponseSchema = list(referenceCodeResponseSchema);

export type ListOrganizationsResponse = z.infer<typeof listOrganizationsResponseSchema>;
export type ListFacilitiesResponse = z.infer<typeof listFacilitiesResponseSchema>;
export type ListDepartmentsResponse = z.infer<typeof listDepartmentsResponseSchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
export type ListTenantsResponse = z.infer<typeof listTenantsResponseSchema>;
export type ListCodeSystemsResponse = z.infer<typeof listCodeSystemsResponseSchema>;
export type ListReferenceCodesResponse = z.infer<typeof listReferenceCodesResponseSchema>;
