import { describe, expect, it } from "vitest";
import {
  createNoteRequestSchema,
  ERROR_CODES,
  openApiDocument,
  problemDetailsSchema,
} from "./index";

describe("api contracts (APDR-0003/0014)", () => {
  it("rejects an empty note body at the edge", () => {
    expect(createNoteRequestSchema.safeParse({ body: "" }).success).toBe(false);
  });

  it("caps note body length (bounded inputs, SDR-0009)", () => {
    expect(createNoteRequestSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });

  it("problem details carry a stable code and correlation id", () => {
    const parsed = problemDetailsSchema.parse({
      title: ERROR_CODES.VALIDATION_FAILED.title,
      status: 422,
      code: "VALIDATION_FAILED",
      correlationId: "abc-123",
    });
    expect(parsed.type).toBe("about:blank");
  });

  it("OpenAPI 3.1 document is generated from the contracts", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.paths["/v1/notes"].post.responses["422"]).toBeDefined();
  });
});
