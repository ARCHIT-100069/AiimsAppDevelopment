/**
 * Generates OpenAPI 3.1 from the Zod contracts (APDR-0014: contract-first —
 * the contracts are the source of truth; the document is derived, never
 * hand-edited). Zod 4's native JSON-Schema export keeps this dependency-free.
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { healthResponseSchema } from "./health";
import {
  createDepartmentRequestSchema,
  createFacilityRequestSchema,
  createOrganizationRequestSchema,
  createTenantRequestSchema,
  createUserRequestSchema,
  assignRoleRequestSchema,
  listCodeSystemsResponseSchema,
  listDepartmentsResponseSchema,
  listFacilitiesResponseSchema,
  listOrganizationsResponseSchema,
  listReferenceCodesResponseSchema,
  listTenantsResponseSchema,
  listUsersResponseSchema,
  departmentResponseSchema,
  facilityResponseSchema,
  organizationResponseSchema,
  tenantResponseSchema,
  userResponseSchema,
} from "./platform";
import { problemDetailsSchema } from "./problem";

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: "openapi-3.0" });

const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: toSchema(problemDetailsSchema) } },
});

const standardErrors = {
  "401": problemResponse("Missing/invalid token (SDR-0001)"),
  "403": problemResponse("RBAC denial (SDR-0002)"),
  "422": problemResponse("Validation failure (APDR-0003)"),
};

const crud = (
  name: string,
  requestSchema: z.ZodType,
  responseSchema: z.ZodType,
  listSchema: z.ZodType,
  extra: Record<string, unknown> = {},
) => ({
  post: {
    summary: `Create ${name} (audited write: row + outbox + audit in one tx)`,
    requestBody: {
      required: true,
      content: { "application/json": { schema: toSchema(requestSchema) } },
    },
    responses: {
      "201": {
        description: `${name} created`,
        content: { "application/json": { schema: toSchema(responseSchema) } },
      },
      "409": problemResponse("Duplicate natural key (duplicate-safe creation)"),
      ...standardErrors,
    },
    ...extra,
  },
  get: {
    summary: `List ${name}s (tenant-scoped, cursor pagination — APDR-0005)`,
    parameters: [
      { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
      {
        name: "cursor",
        in: "query",
        schema: { type: "string" },
        description: "Opaque keyset cursor",
      },
    ],
    responses: {
      "200": {
        description: `${name}s visible to the caller's tenant (RLS-bounded)`,
        content: { "application/json": { schema: toSchema(listSchema) } },
      },
      ...standardErrors,
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AIIMS+ API",
    version: "0.1.0",
    description:
      "Core Platform surface (Stage 1). Versioned URI (/v1), Problem-Details errors (APDR-0002/0003); every write is tenant-scoped, audited, and duplicate-safe.",
  },
  paths: {
    "/healthz": {
      get: {
        summary: "Liveness (public — APDR-0011)",
        security: [],
        responses: {
          "200": {
            description: "Service healthy",
            content: { "application/json": { schema: toSchema(healthResponseSchema) } },
          },
        },
      },
    },
    "/readyz": {
      get: {
        summary: "Readiness — database reachable (public, IDR-0013)",
        security: [],
        responses: {
          "200": { description: "Ready" },
          "503": { description: "Database unreachable" },
        },
      },
    },
    "/v1/tenants": crud(
      "tenant (platform operators only; idempotent with client-supplied id)",
      createTenantRequestSchema,
      tenantResponseSchema,
      listTenantsResponseSchema,
    ),
    "/v1/organizations": crud(
      "organization",
      createOrganizationRequestSchema,
      organizationResponseSchema,
      listOrganizationsResponseSchema,
    ),
    "/v1/facilities": crud(
      "facility",
      createFacilityRequestSchema,
      facilityResponseSchema,
      listFacilitiesResponseSchema,
    ),
    "/v1/departments": crud(
      "department",
      createDepartmentRequestSchema,
      departmentResponseSchema,
      listDepartmentsResponseSchema,
    ),
    "/v1/users": crud("user", createUserRequestSchema, userResponseSchema, listUsersResponseSchema),
    "/v1/users/{id}/roles": {
      post: {
        summary: "Assign a role (idempotent — replay is a no-op 200)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(assignRoleRequestSchema) } },
        },
        responses: {
          "200": { description: "Role assigned (or already assigned)" },
          "404": problemResponse("User, role, or department not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/reference/code-systems": {
      get: {
        summary: "List global code systems (DDR-0012)",
        responses: {
          "200": {
            description: "Code systems",
            content: { "application/json": { schema: toSchema(listCodeSystemsResponseSchema) } },
          },
          ...standardErrors,
        },
      },
    },
    "/v1/reference/codes": {
      get: {
        summary: "List codes of one system (allow-listed filter — APDR-0005)",
        parameters: [
          {
            name: "system",
            in: "query",
            required: true,
            schema: { enum: ["icd-10", "loinc", "snomed"] },
          },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Codes",
            content: { "application/json": { schema: toSchema(listReferenceCodesResponseSchema) } },
          },
          ...standardErrors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      oidc: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  security: [{ oidc: [] }],
} as const;

/* Emit openapi.json when executed directly (pnpm --filter @aiims/api-contracts openapi). */
if (require.main === module) {
  writeFileSync("openapi.json", JSON.stringify(openApiDocument, null, 2));
  process.stdout.write("openapi.json written\n");
}
