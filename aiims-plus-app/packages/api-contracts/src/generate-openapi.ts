/**
 * Generates OpenAPI 3.1 from the Zod contracts (APDR-0014: contract-first —
 * the contracts are the source of truth; the document is derived, never
 * hand-edited). Zod 4's native JSON-Schema export keeps this dependency-free.
 */
import { writeFileSync } from "node:fs";
import { z } from "zod";
import { healthResponseSchema } from "./health";
import { createNoteRequestSchema, listNotesResponseSchema, noteResponseSchema } from "./notes";
import { problemDetailsSchema } from "./problem";

const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { target: "openapi-3.0" });

const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: toSchema(problemDetailsSchema) } },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AIIMS+ API",
    version: "0.0.0",
    description:
      "Stage 0 walking-skeleton surface. Versioned URI (/v1), Problem-Details errors (APDR-0002/0003).",
  },
  paths: {
    "/healthz": {
      get: {
        summary: "Liveness/readiness (public — APDR-0011)",
        security: [],
        responses: {
          "200": {
            description: "Service healthy",
            content: { "application/json": { schema: toSchema(healthResponseSchema) } },
          },
        },
      },
    },
    "/v1/notes": {
      post: {
        summary: "Stage 0 proof: audited tenant-scoped write",
        requestBody: {
          required: true,
          content: { "application/json": { schema: toSchema(createNoteRequestSchema) } },
        },
        responses: {
          "201": {
            description: "Note created (audited via outbox — DDR-0007)",
            content: { "application/json": { schema: toSchema(noteResponseSchema) } },
          },
          "401": problemResponse("Missing/invalid token (SDR-0001)"),
          "403": problemResponse("RBAC denial (SDR-0002)"),
          "422": problemResponse("Validation failure (APDR-0003)"),
        },
      },
      get: {
        summary: "Stage 0 proof: tenant-scoped read (RLS-bounded)",
        responses: {
          "200": {
            description: "Notes visible to the caller's tenant only (DDR-0002)",
            content: { "application/json": { schema: toSchema(listNotesResponseSchema) } },
          },
          "401": problemResponse("Missing/invalid token (SDR-0001)"),
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
