import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3005),
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  ESCROW_API_KEY: z.string().default(''),
  ESCROW_API_URL: z.string().url().default('https://api.escrow.com/2017-09-01'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('payment-service'),
  KAFKA_GROUP_ID: z.string().default('payment-consumers'),
});

export type Env = z.infer<typeof EnvSchema>;
