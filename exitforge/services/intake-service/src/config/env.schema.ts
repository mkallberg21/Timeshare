import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3002),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('intake-service'),
  KAFKA_GROUP_ID: z.string().default('intake-consumers'),
  ML_SERVICE_URL: z.string().url().default('http://ml-service:8001'),
  AI_ORCHESTRATOR_URL: z.string().url().default('http://ai-orchestrator:8005'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DD_SERVICE: z.string().default('exitforge-intake-service'),
  DD_ENV: z.string().default('production'),
});

export type Env = z.infer<typeof EnvSchema>;
