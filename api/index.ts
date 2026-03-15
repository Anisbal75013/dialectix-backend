/**
 * api/index.ts — Vercel Serverless Entry Point
 *
 * This file is the ONLY entry point used on Vercel.
 * It is NOT used for local development (src/main.ts handles that).
 *
 * Key differences vs src/main.ts:
 *  – Does NOT call app.listen()   — Vercel manages the HTTP server
 *  – NO globalPrefix              — routes are served at their natural paths
 *  – Caches the Express handler across warm invocations (zero re-init cost)
 *
 * URL mapping (no /api prefix):
 *  Frontend calls   → https://dialectix-backend.vercel.app/health/db
 *  Vercel rewrite   → /api/index  (vercel.json: "/(.*)" → "/api/index")
 *  NestJS handles   → /health/db  (@Controller('health') + @Get('db'))
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
    methods:        ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    false,
  });

  /* ── Validation pipe ───────────────────────────────────────────────────── */
  app.useGlobalPipes(new ValidationPipe({
    whitelist:            true,   // strip unknown fields
    forbidNonWhitelisted: true,   // 400 on unexpected fields
    transform:            true,   // auto-cast primitive types
  }));

  /* ── Pas de globalPrefix ────────────────────────────────────────────────── *
   * Les routes NestJS sont servies à leur chemin naturel :
   *   GET  /health/db    GET  /users    POST /battles    PATCH /tournaments/:id/status
   * Le frontend appelle directement https://dialectix-backend.vercel.app/<route>
   * ────────────────────────────────────────────────────────────────────────── */

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
