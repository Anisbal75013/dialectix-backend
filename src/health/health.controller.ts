import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: SupabaseService) {}

  /** GET /api/health — basic uptime ping */
  @Get()
  check() {
    return {
      status:    'ok',
      service:   'dialectix-backend',
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
    };
  }

  /** GET /api/health/db — confirms Supabase connectivity */
  @Get('db')
  async dbCheck() {
    const ok = await this.db.ping();
    return ok
      ? { db: 'ok', timestamp: new Date().toISOString() }
      : { db: 'error', message: 'Cannot reach Supabase — check env vars' };
  }
}
