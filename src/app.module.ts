import { Module }       from '@nestjs/common';
import { APP_GUARD }    from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { ConfigModule }       from './config/config.module';
import { SupabaseModule }     from './supabase/supabase.module';
import { AiModule }           from './ai/ai.module';
import { UsersModule }        from './users/users.module';
import { BattlesModule }      from './battles/battles.module';
import { AcademiesModule }    from './academies/academies.module';
import { TournamentsModule }  from './tournaments/tournaments.module';
import { HealthModule }       from './health/health.module';

@Module({
  imports: [
    /* Global env loader — must be first */
    ConfigModule,

    /* Global Supabase client — available in every module */
    SupabaseModule,

    /* Rate limiter: 30 calls / minute / IP */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),

    /* Feature modules */
    AiModule,
    HealthModule,
    UsersModule,
    BattlesModule,
    AcademiesModule,
    TournamentsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
