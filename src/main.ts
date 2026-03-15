import { NestFactory }     from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule }        from './app.module';

async function bootstrap() {
  const app    = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  /* ── Fail-fast: required env vars must be present before we bind ── */
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    logger.error(
      'FATAL: ANTHROPIC_API_KEY is not set. ' +
      'Create a .env.development or .env.production file in the project root, ' +
      'or export the variable before starting the server.',
    );
    process.exit(1);
  }

  /* ── CORS: read allowed origins from env, fall back to localhost dev ── */
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173';
  const allowedOrigins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin:         allowedOrigins,
    methods:        ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    false,
  });

  /* ── Global validation pipe ── */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,   // strip unknown fields
      forbidNonWhitelisted: true,   // 400 on unexpected fields
      transform:            true,   // auto-cast types
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  const env  = process.env.NODE_ENV ?? 'development';
  await app.listen(port);

  logger.log(`Environment              → ${env}`);
  logger.log(`CORS origins             → ${allowedOrigins.join(', ')}`);
  logger.log(`Dialectix backend running → http://localhost:${port}`);
  logger.log(`Health check             → http://localhost:${port}/health`);
  logger.log(`AI judge endpoint        → POST http://localhost:${port}/ai/judge`);
  logger.log(`AI respond endpoint      → POST http://localhost:${port}/ai/respond`);
  logger.log(`AI report endpoint       → POST http://localhost:${port}/ai/report`);
}

bootstrap();
