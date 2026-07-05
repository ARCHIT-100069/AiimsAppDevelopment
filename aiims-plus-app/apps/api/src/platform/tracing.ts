/**
 * OpenTelemetry wiring (IDR-0013): vendor-neutral traces for
 * API → repository → Postgres, activated by OTEL_EXPORTER_OTLP_ENDPOINT
 * (off by default locally — zero overhead until an OTLP backend exists).
 *
 * MUST be imported FIRST in main.ts so instrumentation can patch modules
 * before anything else loads. Reads process.env directly for the same
 * reason (config validation happens later in bootstrap).
 *
 * No PHI in telemetry (SDR-0010): spans carry route/status/db-operation
 * metadata only; request/response bodies are never recorded.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const sdk = new NodeSDK({
    serviceName: "aiims-api",
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }), // no statement values (no PHI)
    ],
  });
  sdk.start();
  process.on("SIGTERM", () => {
    void sdk.shutdown();
  });
}
