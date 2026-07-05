import { describe, expect, it } from "vitest";
import { ERROR_CODES, openApiDocument, problemDetailsSchema } from "./index";

describe("api contracts (APDR-0003/0014)", () => {
  it("problem details carry a stable code and correlation id", () => {
    const parsed = problemDetailsSchema.parse({
      title: ERROR_CODES.VALIDATION_FAILED.title,
      status: 422,
      code: "VALIDATION_FAILED",
      correlationId: "abc-123",
    });
    expect(parsed.type).toBe("about:blank");
  });

  it("OpenAPI 3.1 document covers the Stage 1 platform surface", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    for (const path of [
      "/v1/tenants",
      "/v1/organizations",
      "/v1/facilities",
      "/v1/departments",
      "/v1/users",
      "/v1/reference/codes",
    ]) {
      expect(openApiDocument.paths[path as keyof typeof openApiDocument.paths]).toBeDefined();
    }
  });

  it("writes document the duplicate-safe 409 contract", () => {
    expect(openApiDocument.paths["/v1/organizations"].post.responses["409"]).toBeDefined();
  });
});
