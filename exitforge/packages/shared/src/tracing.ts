/**
 * OpenTelemetry tracing bootstrap.
 * MUST be imported before any other modules.
 *
 * Usage (top of main.ts, before any other imports):
 *   import './tracing';
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const serviceName = process.env["DD_SERVICE"] ?? process.env["npm_package_name"] ?? "exitforge-service";
const serviceVersion = process.env["npm_package_version"] ?? "0.0.0";
const otlpEndpoint = process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://otel-collector:4318/v1/traces";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env["NODE_ENV"] ?? "development",
  }),
  traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs instrumentation creates too much noise
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-http": { enabled: true },
      "@opentelemetry/instrumentation-express": { enabled: true },
      "@opentelemetry/instrumentation-net": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
});
