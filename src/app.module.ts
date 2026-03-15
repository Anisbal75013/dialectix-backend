import { Module }       from '@nestjs/common';
import { APP_GUARD }    from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { ConfigModule }      from './config/config.module';
import { AiModule }          from './ai/ai.module';
import { HealthController }  from './health/health.controller';

@Module({
  imports: [
    /* Global env loader — must be first */
    ConfigModule,

    /* Rate limiter: 30 AI calls / minute / IP */
    ThrottlerModule.forRoot([
      {
        ttl:   60_000,  // window in ms
        limit: 30,      // max requests per window per IP
      },
    ]),

    /* Feature modules */
    AiModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide:  APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
