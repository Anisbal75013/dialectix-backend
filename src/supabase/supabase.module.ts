/**
 * supabase.module.ts — Global module so SupabaseService is injectable everywhere.
 */
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  providers: [SupabaseService],
  exports:   [SupabaseService],
})
export class SupabaseModule {}
