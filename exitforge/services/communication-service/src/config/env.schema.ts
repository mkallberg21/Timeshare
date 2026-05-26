import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3004),
  SENDGRID_API_KEY: z.string().min(1),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_FROM_NUMBER: z.string().default(''),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('communication-service'),
  KAFKA_GROUP_ID: z.string().default('communication-consumers'),
  DD_SERVICE: z.string().default('exitforge-communication-service'),
});

export type EnvSchema = z.infer<typeof EnvSchema>;
