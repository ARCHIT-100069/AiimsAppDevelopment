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
import {
  appointmentResponseSchema,
  cancelAppointmentRequestSchema,
  checkInResponseSchema,
  createAppointmentRequestSchema,
  listAppointmentsResponseSchema,
  updateAppointmentRequestSchema,
} from "./appointments";
import {
  availabilityResponseSchema,
  createAvailabilityRequestSchema,
  listAvailabilityResponseSchema,
  slotsResponseSchema,
} from "./availability";
const mySlotsResponseSchema = slotsResponseSchema;
import { queueResponseSchema } from "./queue";
import {
  encounterResponseSchema,
  signEncounterRequestSchema,
  updateEncounterRequestSchema,
} from "./encounters";
import {
  amendNoteRequestSchema,
  createNoteRequestSchema,
  listNotesResponseSchema,
  noteResponseSchema,
} from "./clinical-notes";
import {
  createObservationRequestSchema,
  listObservationsResponseSchema,
  observationResponseSchema,
} from "./observations";
import {
  conditionResponseSchema,
  createConditionRequestSchema,
  listConditionsResponseSchema,
} from "./conditions";
import {
  createOrderRequestSchema,
  createResultRequestSchema,
  listOrdersResponseSchema,
  listResultsResponseSchema,
  orderResponseSchema,
  resultResponseSchema,
} from "./orders";
import {
  attachmentResponseSchema,
  presignDownloadResponseSchema,
  presignUploadRequestSchema,
  presignUploadResponseSchema,
  registerAttachmentRequestSchema,
} from "./attachments";
import {
  generateInvoiceRequestSchema,
  invoiceResponseSchema,
  payInvoiceRequestSchema,
  shareEncounterRequestSchema,
  shareEncounterResponseSchema,
} from "./invoices";
import { codingSuggestRequestSchema, codingSuggestResponseSchema } from "./ai";
import {
  mySummaryResponseSchema,
  bookableOptionsResponseSchema,
  bookMyAppointmentRequestSchema,
  myAppointmentSchema,
} from "./me";
import {
  createDrugRequestSchema,
  listDrugsResponseSchema,
  drugResponseSchema,
  addStockRequestSchema,
  createPrescriptionRequestSchema,
  prescriptionResponseSchema,
  listPrescriptionsResponseSchema,
  dispenseResponseSchema,
} from "./pharmacy";
import {
  createFeedbackRequestSchema,
  feedbackResponseSchema,
  listFeedbackResponseSchema,
} from "./feedback";
import {
  fileLabResultRequestSchema,
  labResultResponseSchema,
  listLabWorklistResponseSchema,
} from "./laboratory";
import { fhirPatientSchema } from "./fhir";
import { fhirPractitionerSchema } from "./fhir-practitioner";
import { fhirAppointmentSchema } from "./fhir-appointment";
import { fhirBundleSchema, fhirEncounterSchema } from "./fhir-encounter";
import { fhirInvoiceSchema } from "./fhir-invoice";
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

const ifMatchHeader = {
  name: "If-Match",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "Current version token; stale ⇒ 409",
};

const idempotencyKeyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string", minLength: 8, maxLength: 128 },
  description: "Replay-safe key for this clinical write (APDR-0006)",
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

/** POST a documentation child under an encounter (in_progress only). */
const encChildPost = (name: string, req: z.ZodType, res: z.ZodType) => ({
  post: {
    summary: `Record ${name} on an encounter (in_progress only; signed ⇒ 409)`,
    parameters: [uuidPathParam],
    requestBody: {
      required: true,
      content: { "application/json": { schema: toSchema(req) } },
    },
    responses: {
      "201": jsonOk(`${name} recorded`, res),
      "404": problemResponse("Encounter not found in this tenant"),
      "409": problemResponse("Encounter is signed/finalized (amend instead)"),
      ...standardErrors,
    },
  },
});
/** GET the documentation children of an encounter. */
const encChildList = (name: string, listSchema: z.ZodType) => ({
  get: {
    summary: `List ${name} for an encounter (tenant-scoped)`,
    parameters: [uuidPathParam],
    responses: {
      "200": jsonOk(`${name} for the encounter`, listSchema),
      "404": problemResponse("Encounter not found in this tenant"),
      ...standardErrors,
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AIIMS+ API",
    version: "0.7.0",
    description:
      "AIIMS+ API through Stage 7 (Core Platform + Patient + Practitioner + Appointments/OPD + EMR + Billing + operational AI). Versioned URI (/v1), Problem-Details errors (APDR-0002/0003); every write is tenant-scoped, audited, and duplicate-safe. Double-booking is prevented by a DB slot-exclusion constraint. Clinical documentation is signed (human-only) and amended by versioning (DDR-0013); large files use presigned object URLs (APDR-0007). FHIR R4 read surfaces are dark by default behind the fhir.read flag.",
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

    // ---- Stage 4: Appointments / OPD scheduling ----
    "/v1/appointments": {
      post: {
        summary:
          "Book an appointment (Idempotency-Key REQUIRED). Double-booking is rejected by the DB slot-exclusion constraint → 409.",
        parameters: [idempotencyKeyHeader],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createAppointmentRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Appointment booked", appointmentResponseSchema),
          "200": jsonOk(
            "Idempotent replay — original appointment returned",
            appointmentResponseSchema,
          ),
          "409": problemResponse("Slot conflict (double-booking) or duplicate idempotency key"),
          "404": problemResponse(
            "Patient, practitioner, department, or facility not found in this tenant",
          ),
          ...standardErrors,
        },
      },
      get: {
        summary:
          "Search appointments (allow-listed: one of patient / practitioner / department, optional date range — APDR-0005)",
        parameters: [
          { name: "patientId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "practitionerId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": jsonOk(
            "Appointments visible to the caller's tenant (RLS-bounded)",
            listAppointmentsResponseSchema,
          ),
          ...standardErrors,
        },
      },
    },
    "/v1/appointments/{id}": {
      ...readById("appointment", appointmentResponseSchema),
      patch: {
        summary:
          "Reschedule / edit an appointment (If-Match required). A new slot that overlaps another booking ⇒ 409.",
        parameters: [uuidPathParam, ifMatchHeader],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(updateAppointmentRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Appointment updated", appointmentResponseSchema),
          "409": problemResponse("Version conflict (DDR-0009) or slot conflict"),
          "404": problemResponse("Appointment not visible to the caller's tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/appointments/{id}/cancel": {
      post: {
        summary: "Cancel an appointment (If-Match) — frees the slot",
        parameters: [uuidPathParam, ifMatchHeader],
        requestBody: {
          required: false,
          content: { "application/json": { schema: toSchema(cancelAppointmentRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Appointment cancelled", appointmentResponseSchema),
          "409": problemResponse("Version conflict or invalid state transition"),
          "404": problemResponse("Appointment not visible to the caller's tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/appointments/{id}/no-show": {
      post: {
        summary: "Mark an appointment as no-show (If-Match) — frees the slot",
        parameters: [uuidPathParam, ifMatchHeader],
        responses: {
          "200": jsonOk("Appointment marked no-show", appointmentResponseSchema),
          "409": problemResponse("Version conflict or invalid state transition"),
          "404": problemResponse("Appointment not visible to the caller's tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/appointments/{id}/check-in": {
      post: {
        summary:
          "Check in an arrived patient (Idempotency-Key) — issues a queue token and OPENS a clinical encounter",
        parameters: [uuidPathParam, idempotencyKeyHeader],
        responses: {
          "200": jsonOk(
            "Checked in — appointment + opened encounter id + queue token",
            checkInResponseSchema,
          ),
          "409": problemResponse("Invalid state transition (not currently booked)"),
          "404": problemResponse("Appointment not visible to the caller's tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/practitioners/{id}/slots": {
      get: {
        summary:
          "Computed free slots for a practitioner on a date (advisory; the DB constraint is authoritative)",
        parameters: [
          uuidPathParam,
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": jsonOk("Bookable slots", slotsResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/practitioner-availability": {
      post: {
        summary: "Create a recurring availability template (admin)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createAvailabilityRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Availability template created", availabilityResponseSchema),
          "404": problemResponse("Practitioner or facility not found in this tenant"),
          ...standardErrors,
        },
      },
      get: {
        summary: "List availability templates for a practitioner",
        parameters: [
          {
            name: "practitionerId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonOk("Availability templates", listAvailabilityResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/opd/queue": {
      get: {
        summary:
          "The live OPD waiting queue for a facility/department on a date (ordered by priority, token)",
        parameters: [
          {
            name: "facilityId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          { name: "departmentId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "date", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": jsonOk("Ordered queue entries", queueResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}": {
      ...readById("encounter", encounterResponseSchema),
      patch: {
        summary: "Update the encounter's chief complaint (while in_progress; If-Match)",
        parameters: [uuidPathParam, ifMatchHeader],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(updateEncounterRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Encounter updated", encounterResponseSchema),
          "409": problemResponse("Version conflict or encounter already signed"),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/fhir/R4/Appointment/{id}": fhirRead("Appointment", fhirAppointmentSchema),

    // ---- Stage 5: EMR — encounter documentation, sign, orders/results ----
    "/v1/encounters/{id}/sign": {
      post: {
        summary:
          "Sign/finalize the encounter (Constitution: doctor-only, human). Freezes documentation; If-Match.",
        parameters: [uuidPathParam, ifMatchHeader],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(signEncounterRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Encounter signed", encounterResponseSchema),
          "409": problemResponse("Version conflict or already signed"),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}/notes": {
      ...encChildPost("clinical note", createNoteRequestSchema, noteResponseSchema),
      ...encChildList("clinical notes (latest versions)", listNotesResponseSchema),
    },
    "/v1/notes/{id}/amend": {
      post: {
        summary: "Amend a note (creates a new version, DDR-0013; the prior version is retained)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(amendNoteRequestSchema) } },
        },
        responses: {
          "201": jsonOk("New note version created", noteResponseSchema),
          "404": problemResponse("Note not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}/observations": {
      ...encChildPost("observation", createObservationRequestSchema, observationResponseSchema),
      ...encChildList("observations", listObservationsResponseSchema),
    },
    "/v1/encounters/{id}/conditions": {
      ...encChildPost("condition", createConditionRequestSchema, conditionResponseSchema),
      ...encChildList("conditions", listConditionsResponseSchema),
    },
    "/v1/encounters/{id}/orders": {
      ...encChildPost("service request (order)", createOrderRequestSchema, orderResponseSchema),
      ...encChildList("orders", listOrdersResponseSchema),
    },
    "/v1/encounters/{id}/results": encChildList(
      "diagnostic reports (results)",
      listResultsResponseSchema,
    ),
    "/v1/orders/{id}/results": {
      post: {
        summary: "File a diagnostic report against an order (result)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createResultRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Result filed", resultResponseSchema),
          "404": problemResponse("Order or attachment not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}/attachments": {
      post: {
        summary: "Register an uploaded attachment's metadata (after the presigned PUT)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(registerAttachmentRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Attachment registered", attachmentResponseSchema),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}/attachments/presign-upload": {
      post: {
        summary:
          "Get a presigned PUT URL to upload a large file directly to object storage (APDR-0007)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(presignUploadRequestSchema) } },
        },
        responses: {
          "200": jsonOk(
            "Presigned upload URL + tenant-scoped object key",
            presignUploadResponseSchema,
          ),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/attachments/{id}/download-url": {
      get: {
        summary: "Get a presigned GET URL to download an attachment (APDR-0007)",
        parameters: [uuidPathParam],
        responses: {
          "200": jsonOk("Presigned download URL", presignDownloadResponseSchema),
          "404": problemResponse("Attachment not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    // ---- Stage 6: Billing — invoice an encounter, (mock) pay, share ----
    "/v1/encounters/{id}/invoice": {
      post: {
        summary:
          "Generate an invoice for an encounter (charge capture; one per encounter → 409 on repeat)",
        parameters: [uuidPathParam],
        requestBody: {
          required: false,
          content: { "application/json": { schema: toSchema(generateInvoiceRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Invoice generated", invoiceResponseSchema),
          "409": problemResponse("An invoice already exists for this encounter"),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
      get: {
        summary: "Get the invoice for an encounter",
        parameters: [uuidPathParam],
        responses: {
          "200": jsonOk("Invoice", invoiceResponseSchema),
          "404": problemResponse("No invoice for this encounter"),
          ...standardErrors,
        },
      },
    },
    "/v1/invoices/{id}": readById("invoice", invoiceResponseSchema),
    "/v1/invoices/{id}/pay": {
      post: {
        summary: "Settle an invoice via the (mock) payment gateway (Idempotency-Key; replay-safe)",
        parameters: [uuidPathParam, idempotencyKeyHeader],
        requestBody: {
          required: false,
          content: { "application/json": { schema: toSchema(payInvoiceRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Invoice paid", invoiceResponseSchema),
          "409": problemResponse("Invoice already paid or cancelled"),
          "404": problemResponse("Invoice not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/v1/encounters/{id}/share": {
      post: {
        summary:
          "Mock ABDM share-on-consent — link the encounter care context after validating a (mock) consent artifact",
        parameters: [uuidPathParam],
        requestBody: {
          required: false,
          content: { "application/json": { schema: toSchema(shareEncounterRequestSchema) } },
        },
        responses: {
          "200": jsonOk("Care context shared (mock)", shareEncounterResponseSchema),
          "409": problemResponse("Consent could not be validated for this share"),
          "404": problemResponse("Encounter not found in this tenant"),
          ...standardErrors,
        },
      },
    },
    "/fhir/R4/Invoice/{id}": fhirRead("Invoice", fhirInvoiceSchema),

    // ---- Stage 7: AI (operational-only, HITL; dark behind ai.coding_assist) ----
    "/v1/ai/coding-suggestion": {
      post: {
        summary:
          "AI ICD-10 coding suggestion (operational-only, HITL — advisory, labelled, never auto-applied; PHI-redacted; dark behind the ai.coding_assist flag → 404 when off)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(codingSuggestRequestSchema) } },
        },
        responses: {
          "200": jsonOk(
            "Labelled coding suggestions (verify before use)",
            codingSuggestResponseSchema,
          ),
          "404": problemResponse("AI capability disabled for this tenant"),
          "502": problemResponse(
            "AI plane/provider unavailable — care is never blocked (AIDR-0014)",
          ),
          ...standardErrors,
        },
      },
    },

    "/v1/me/summary": {
      get: {
        summary:
          "Patient portal — the signed-in patient's own profile, appointments, diagnoses, invoices, visits, and reports (self:read; scoped to the token's patient_id + tenant RLS)",
        responses: {
          "200": jsonOk("The patient's own health summary", mySummaryResponseSchema),
          ...standardErrors,
        },
      },
    },

    "/v1/drugs": {
      get: {
        summary: "Pharmacy — drug master with on-hand stock (pharmacy:read)",
        responses: {
          "200": jsonOk("Drugs with stock", listDrugsResponseSchema),
          ...standardErrors,
        },
      },
      post: {
        summary: "Pharmacy — add a drug to the formulary (pharmacy:manage)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createDrugRequestSchema) } },
        },
        responses: {
          "201": jsonOk("The created drug", drugResponseSchema),
          "409": problemResponse("Drug already exists"),
          ...standardErrors,
        },
      },
    },
    "/v1/drugs/{id}/stock": {
      post: {
        summary: "Pharmacy — receive a stock batch for a drug (pharmacy:manage)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(addStockRequestSchema) } },
        },
        responses: {
          "201": jsonOk("Updated drug stock", drugResponseSchema),
          "404": problemResponse("Drug not found"),
          ...standardErrors,
        },
      },
    },
    "/v1/prescriptions": {
      get: {
        summary: "Pharmacy — prescriptions (queue); filter by status (prescription:read)",
        parameters: [
          { name: "status", in: "query", schema: { enum: ["active", "dispensed", "cancelled"] } },
        ],
        responses: {
          "200": jsonOk("Prescriptions", listPrescriptionsResponseSchema),
          ...standardErrors,
        },
      },
      post: {
        summary: "Prescriber — write a prescription for a patient (prescription:write)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createPrescriptionRequestSchema) } },
        },
        responses: {
          "201": jsonOk("The written prescription", prescriptionResponseSchema),
          "404": problemResponse("Patient or drug not found"),
          ...standardErrors,
        },
      },
    },
    "/v1/prescriptions/{id}/dispense": {
      post: {
        summary: "Pharmacy — dispense a prescription; draws stock down FEFO (pharmacy:dispense)",
        parameters: [uuidPathParam],
        responses: {
          "200": jsonOk("Dispensed", dispenseResponseSchema),
          "404": problemResponse("Prescription not found"),
          "409": problemResponse("Insufficient stock or already dispensed"),
          ...standardErrors,
        },
      },
    },

    "/v1/me/practitioners": {
      get: {
        summary:
          "Patient portal — practitioners the patient can book an appointment with (self:read)",
        responses: {
          "200": jsonOk("Bookable practitioners", bookableOptionsResponseSchema),
          ...standardErrors,
        },
      },
    },

    "/v1/me/slots": {
      get: {
        summary:
          "Patient portal — available appointment slots for a practitioner on a date (self:read)",
        parameters: [
          {
            name: "practitionerId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: {
          "200": jsonOk("Available slots", mySlotsResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/me/appointments": {
      post: {
        summary:
          "Patient portal — book an appointment for oneself (self:book; patient id is taken from the token, never the body)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(bookMyAppointmentRequestSchema) } },
        },
        responses: {
          "201": jsonOk("The booked appointment", myAppointmentSchema),
          "409": problemResponse("Slot unavailable (double-booking) or duplicate"),
          ...standardErrors,
        },
      },
    },

    "/v1/me/feedback": {
      post: {
        summary:
          "Patient portal — submit satisfaction feedback about one's own care (self:feedback; patient id is taken from the token, never the body)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createFeedbackRequestSchema) } },
        },
        responses: {
          "201": jsonOk("The submitted feedback", feedbackResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/feedback": {
      get: {
        summary: "Quality — list patient-satisfaction feedback for the tenant (feedback:read)",
        responses: {
          "200": jsonOk("Patient feedback", listFeedbackResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/lab/worklist": {
      get: {
        summary:
          "Laboratory — facility-wide worklist of lab orders (pending + resulted) (lab:read)",
        parameters: [
          {
            name: "facilityId",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": jsonOk("Lab worklist", listLabWorklistResponseSchema),
          ...standardErrors,
        },
      },
    },
    "/v1/lab/orders/{id}/result": {
      post: {
        summary:
          "Laboratory — file a result (conclusion + structured analyte lines) against an order and close it (lab:result)",
        parameters: [uuidPathParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(fileLabResultRequestSchema) } },
        },
        responses: {
          "201": jsonOk("The filed lab result", labResultResponseSchema),
          "404": problemResponse("Order not found"),
          ...standardErrors,
        },
      },
    },

    "/fhir/R4/Encounter/{id}": fhirRead("Encounter", fhirEncounterSchema),
    "/fhir/R4/Encounter/{id}/$everything": {
      get: {
        summary:
          "FHIR Encounter $everything — a Bundle of the encounter + observations/conditions/notes/orders/results (dark by fhir.read)",
        parameters: [uuidPathParam],
        responses: {
          "200": {
            description: "FHIR collection Bundle",
            content: { "application/fhir+json": { schema: toSchema(fhirBundleSchema) } },
          },
          "404": problemResponse("Not found, or FHIR surface disabled for this tenant"),
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
