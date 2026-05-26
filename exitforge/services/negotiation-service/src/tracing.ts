/**
 * OpenTelemetry tracing bootstrap for negotiation-service.
 * MUST be the first import in main.ts.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const serviceName = process.env["DD_SERVICE"] ?? "negotiation-service";
const otlpEndpoint =
  process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "http://otel-collector:4318/v1/traces";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env["NODE_ENV"] ?? "development",
  }),
  traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
      "@opentelemetry/instrumentation-net": { enabled: false },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", async () => {
  await sdk.shutdown();
});
