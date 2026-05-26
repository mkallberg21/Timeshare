import "./tracing";
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvSchema } from './config/env.schema';
import { z } from 'zod';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate environment variables at startup — fail fast
  const envResult = EnvSchema.safeParse(process.env);
  if (!envResult.success) {
    logger.error('Invalid environment variables:');
    logger.error(JSON.stringify(envResult.error.flatten(), null, 2));
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose'],
  });

  // Global validation pipe — strip unknown properties, whitelist only
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('ExitForge Case Service')
    .setDescription('Core case management, state machine, and Kafka event emission')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Enable CORS for web/admin apps only
  app.enableCors({
    origin: [
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  });

  const port = parseInt(process.env['PORT'] ?? '4000', 10);
  await app.listen(port);
  logger.log(`Case service listening on port ${port}`);
  logger.log(`OpenAPI docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
