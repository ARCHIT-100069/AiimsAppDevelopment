export * from "./problem";
export * from "./health";
export * from "./pagination";
export * from "./platform";
export * from "./patients";
export * from "./practitioners";
export * from "./appointments";
export * from "./availability";
export * from "./queue";
export * from "./encounters";
export * from "./coding";
export * from "./clinical-notes";
export * from "./observations";
export * from "./conditions";
export * from "./orders";
export * from "./attachments";
export * from "./invoices";
export * from "./ai";
export * from "./me";
export * from "./pharmacy";
export * from "./feedback";
export * from "./laboratory";
export * from "./management";
export * from "./fhir";
export * from "./fhir-practitioner";
export * from "./fhir-appointment";
export * from "./fhir-encounter";
export * from "./fhir-invoice";
// NOTE: openApiDocument is intentionally NOT re-exported here. That module
// has a top-level `node:fs` import (used only by its CLI runner), and
// re-exporting it from this barrel pulls `node:fs` into every consumer —
// including the browser bundle for apps/web, which crashes at runtime.
// Import it directly from "@aiims/api-contracts/generate-openapi" instead.
