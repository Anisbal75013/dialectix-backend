/**
 * supabase.service.ts
 *
 * Singleton Supabase client using the SERVICE_ROLE_KEY (backend only).
 * This key MUST NEVER be sent to the frontend.
 *
 * Provides typed access methods for every table:
 *   users | battles | academies | academy_members | tournaments
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService }                     from '@nestjs/config';
import { createClient, SupabaseClient }      from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !key) {
      this.logger.error(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing — DB features disabled.',
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });

    this.logger.log('Supabase client initialised ✓');
  }

  /** Raw client — use only when typed helpers don't cover your use case */
  getClient(): SupabaseClient {
    if (!this.client) throw new Error('Supabase client not initialised');
    return this.client;
  }

  /* ── Typed table accessors ─────────────────────────────────────────────── */

  users()           { return this.getClient().from('users'); }
  battles()         { return this.getClient().from('battles'); }
  academies()       { return this.getClient().from('academies'); }
  academyMembers()  { return this.getClient().from('academy_members'); }
  tournaments()     { return this.getClient().from('tournaments'); }

  /* ── Connectivity test (used by /api/health/db) ─────────────────────────── */
  async ping(): Promise<boolean> {
    try {
      const { error } = await this.users().select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
