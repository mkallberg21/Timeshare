import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3006),
  CLERK_SECRET_KEY: z.string().min(1),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('legal-service'),
  KAFKA_GROUP_ID: z.string().default('legal-consumers'),
  DD_SERVICE: z.string().default('exitforge-legal-service'),
});

export type EnvSchema = z.infer<typeof EnvSchema>;
