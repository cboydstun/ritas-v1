import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Ensure required environment variables are present
const axiomToken = process.env.NEXT_PUBLIC_AXIOM_TOKEN;
const axiomDataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;

if (!axiomToken || !axiomDataset) {
  throw new Error('Missing required Axiom environment variables');
}

// Initialize OTLP trace exporter with Axiom configuration
const traceExporter = new OTLPTraceExporter({
  url: 'https://api.axiom.co/v1/traces',
  headers: {
    'Authorization': `Bearer ${axiomToken}`,
    'X-Axiom-Dataset': axiomDataset
  },
});

// Define resource attributes
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'ritas-rentals',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
});

// Configure auto-instrumentations
const instrumentations = [
  getNodeAutoInstrumentations({
    // Disable noisy instrumentations
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      ignoreIncomingRequestHook: (req) => {
        const url = req.url || '';
        const pathsToIgnore = [
          '/favicon.ico',
          '/robots.txt',
          '/_next/static/.*',
          '/public/.*'
        ];
        return pathsToIgnore.some(path => new RegExp(path).test(url));
      },
    },
    '@opentelemetry/instrumentation-express': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-mongodb': {
      enabled: true,
      enhancedDatabaseReporting: true,
    },
  }),
];

// Create and configure the OpenTelemetry SDK
export const otelSDK = new NodeSDK({
  spanProcessor: new BatchSpanProcessor(traceExporter),
  resource: resource,
  instrumentations,
});

// Function to initialize OpenTelemetry
export async function initTelemetry(): Promise<void> {
  try {
    await otelSDK.start();
    console.log('OpenTelemetry initialized successfully');
  } catch (error: unknown) {
    console.error('Error initializing OpenTelemetry:', error instanceof Error ? error.message : error);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => console.log('OpenTelemetry SDK shut down successfully'))
    .catch((error: unknown) => console.error(
      'Error shutting down OpenTelemetry SDK:',
      error instanceof Error ? error.message : error
    ))
    .finally(() => process.exit(0));
});
