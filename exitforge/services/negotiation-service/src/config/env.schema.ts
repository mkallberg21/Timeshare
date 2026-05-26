import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3003),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  S3_BUCKET_NAME: z.string().default('exitforge-documents'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('negotiation-service'),
  KAFKA_GROUP_ID: z.string().default('negotiation-consumers'),
  LEGAL_SERVICE_URL: z.string().url().default('http://legal-service:8004'),
  SENDGRID_API_KEY: z.string().default(''),
  DD_SERVICE: z.string().default('exitforge-negotiation-service'),
});

export type Env = z.infer<typeof EnvSchema>;
