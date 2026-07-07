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
import {
  createPatientRequestSchema,
  listPatientsResponseSchema,
  patientResponseSchema,
  updatePatientRequestSchema,
} from "./patients";
import {
  createPractitionerRequestSchema,
  createPractitionerResponseSchema,
  listPractitionersResponseSchema,
  practitionerResponseSchema,
  updatePractitionerRequestSchema,
} from "./practitioners";
import { fhirPatientSchema } from "./fhir";
import { fhirPractitionerSchema } from "./fhir-practitioner";
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

const uuidPathParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const jsonOk = (description: string, schema: z.ZodType) => ({
  description,
  content: { "application/json": { schema: toSchema(schema) } },
});

/** GET /:id — tenant-scoped read (audited for clinical resources). */
const readById = (name: string, responseSchema: z.ZodType) => ({
  get: {
    summary: `Get one ${name} by id (tenant-scoped; RLS-bounded)`,
    parameters: [uuidPathParam],
    responses: {
      "200": jsonOk(`${name} found`, responseSchema),
      "404": problemResponse(`${name} not visible to the caller's tenant`),
      ...standardErrors,
    },
  },
});

/** PATCH /:id — optimistic concurrency via If-Match (DDR-0009 → 409). */
const patchById = (name: string, requestSchema: z.ZodType, responseSchema: z.ZodType) => ({
  patch: {
    summary: `Update ${name} (optimistic concurrency — If-Match required, APDR-0006)`,
    parameters: [
      uuidPathParam,
      {
        name: "If-Match",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Current version token; stale ⇒ 409",
      },
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema: toSchema(requestSchema) } },
    },
    responses: {
      "200": jsonOk(`${name} updated`, responseSchema),
      "409": problemResponse("Version conflict — refetch and retry (DDR-0009)"),
      "404": problemResponse(`${name} not visible to the caller's tenant`),
      ...standardErrors,
    },
  },
});

/** GET /fhir/R4/{Resource}/:id — dark by default behind `fhir.read` (returns 404 when off). */
const fhirRead = (resourceType: string, schema: z.ZodType) => ({
  get: {
    summary: `Read FHIR R4 ${resourceType} (dark by default — gated on the fhir.read flag; 404 when disabled)`,
    parameters: [uuidPathParam],
    responses: {
      "200": {
        description: `FHIR ${resourceType} regenerated from the relational model (ADR-0003/DDR-0005)`,
        content: { "application/fhir+json": { schema: toSchema(schema) } },
      },
      "404": problemResponse("Resource not found, or FHIR surface disabled for this tenant"),
      ...standardErrors,
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AIIMS+ API",
    version: "0.3.0",
    description:
      "AIIMS+ API through Stage 3 (Core Platform + Patient + Practitioner). Versioned URI (/v1), Problem-Details errors (APDR-0002/0003); every write is tenant-scoped, audited, and duplicate-safe. FHIR R4 read surfaces are dark by default behind the fhir.read flag.",
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
            schema: { enum: ["icd-10", "loinc", "snomed", "specialty"] },
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

    // ---- Stage 2: Patients (PHI; identifiers encrypted at rest — DDR-0006) ----
    "/v1/patients": {
      post: {
        summary:
          "Register a patient (Idempotency-Key REQUIRED — APDR-0006; replay returns the original)",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", minLength: 8, maxLength: 128 },
            description: "Replay-safe key for this clinical write",
          },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createPatientRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Patient registered", patientResponseSchema),
          "200": jsonOk("Idempotent replay — original patient returned", patientResponseSchema),
          "409": problemResponse("Duplicate natural key (duplicate-safe creation)"),
          ...standardErrors,
        },
      },
      get: {
        summary:
          "Search patients (allow-listed: name trigram / MRN prefix / one blind-indexed identifier — APDR-0005)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Name (trigram)" },
          { name: "mrn", in: "query", schema: { type: "string" }, description: "MRN prefix" },
          {
            name: "phone",
            in: "query",
            schema: { type: "string" },
            description: "Exact phone (blind index)",
          },
          {
            name: "abha",
            in: "query",
            schema: { type: "string" },
            description: "Exact ABHA (blind index)",
          },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonOk(
            "Patients visible to the caller's tenant (RLS-bounded)",
            listPatientsResponseSchema,
          ),
          ...standardErrors,
        },
      },
    },
    "/v1/patients/{id}": {
      ...readById("patient", patientResponseSchema),
      ...patchById("patient", updatePatientRequestSchema, patientResponseSchema),
    },
    "/fhir/R4/Patient/{id}": fhirRead("Patient", fhirPatientSchema),

    // ---- Stage 3: Practitioners (clinical profile over an app_user) ----
    "/v1/practitioners": {
      post: {
        summary:
          "Register a practitioner over an existing app_user (immutable link; duplicate-safe → 409). May return non-blocking warnings (decision i).",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createPractitionerRequestSchema) } },
        },
        responses: {
          "201": jsonOk(
            "Practitioner created (with any advisory warnings)",
            createPractitionerResponseSchema,
          ),
          "409": problemResponse("Duplicate registration number in this tenant"),
          "404": problemResponse("Linked app_user or department not found in this tenant"),
          ...standardErrors,
        },
      },
      get: {
        summary:
          "Search practitioners (allow-listed: name trigram / registration / department — APDR-0005)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Name (trigram)" },
          {
            name: "registrationNo",
            in: "query",
            schema: { type: "string" },
            description: "Exact registration",
          },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonOk(
            "Practitioners visible to the caller's tenant (RLS-bounded)",
            listPractitionersResponseSchema,
          ),
          ...standardErrors,
        },
      },
    },
    "/v1/practitioners/{id}": {
      ...readById("practitioner", practitionerResponseSchema),
      ...patchById("practitioner", updatePractitionerRequestSchema, practitionerResponseSchema),
    },
    "/fhir/R4/Practitioner/{id}": fhirRead("Practitioner", fhirPractitionerSchema),
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
