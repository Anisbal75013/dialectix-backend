/**
 * api/index.ts — Vercel Serverless Entry Point
 *
 * This file is the ONLY entry point used on Vercel.
 * It is NOT used for local development (src/main.ts handles that).
 *
 * Key differences vs src/main.ts:
 *  – Does NOT call app.listen() — Vercel manages the HTTP server
 *  – Sets globalPrefix('api') so routes match /api/ai/* as called by the frontend
 *  – Caches the Express handler across warm invocations (zero re-init cost)
 *
 * URL mapping:
 *  Frontend calls   → https://dialectix-backend.vercel.app/api/ai/judge
 *  Vercel routes    → this function (vercel.json: "/(.*)" → "/api/index.ts")
 *  NestJS handles   → /api/ai/judge  (globalPrefix = 'api', controller = 'ai')
 */

import { NestFactory }    from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule }      from '../src/app.module';
import type { IncomingMessage, ServerResponse } from 'http';

/* ── Bootstrap (runs once at cold-start, cached for warm invocations) ─────── */
async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // Suppress verbose logs in production — errors/warnings only
    logger: isProd ? ['error', 'warn'] : ['log', 'debug', 'error', 'warn', 'verbose'],
  });

  /* ── CORS ──────────────────────────────────────────────────────────────── *
   * ALLOWED_ORIGINS must be set in Vercel → Settings → Environment Variables
   * Example value: https://dialectix.vercel.app
   * Multiple origins are comma-separated: https://a.vercel.app,https://b.vercel.app
   */
  const rawOrigins   = process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173';
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin:         allowedOrigins,
    methods:        ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    false,
  });

  /* ── Validation pipe ───────────────────────────────────────────────────── */
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,   // strip unknown fields
    forbidNonWhitelisted: true,   // 400 on unexpected fields
    transform:            true,   // auto-cast primitive types
  }));

  /* ── Global prefix ─────────────────────────────────────────────────────── *
   * Vercel routes all traffic to this function, so NestJS receives full paths:
   *   /api/ai/judge  |  /api/ai/respond  |  /api/ai/report  |  /api/health
   * Setting globalPrefix('api') makes the controllers match these paths.
   * ── NOT set in src/main.ts (local dev uses /ai/judge directly) ──────────
   */
  app.setGlobalPrefix('api');

  await app.init();

  // Return the underlying Express application instance
  return app.getHttpAdapter().getInstance();
}

/* Resolved once at module load; awaited inside the exported handler */
const handlerPromise = bootstrap();

/* ── Vercel handler (exported as default) ─────────────────────────────────── */
export default async (req: IncomingMessage, res: ServerResponse) => {
  const expressApp = await handlerPromise;
  expressApp(req, res);
};
