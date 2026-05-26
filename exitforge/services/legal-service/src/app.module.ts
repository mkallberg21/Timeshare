import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvSchema } from './config/env.schema';
import { AttorneyModule } from './attorneys/attorney.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlaModule } from './sla/sla.module';

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
    PrismaModule,
    AttorneyModule,
    SlaModule,
  ],
})
export class AppModule {}
