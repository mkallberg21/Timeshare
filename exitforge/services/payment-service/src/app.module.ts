import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvSchema } from './config/env.schema';
import { PaymentModule } from './payments/payment.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const result = EnvSchema.safeParse(config);
        if (!result.success) throw new Error(result.error.toString());
        return result.data;
      },
    }),
    KafkaModule,
    PaymentModule,
  ],
})
export class AppModule {}
