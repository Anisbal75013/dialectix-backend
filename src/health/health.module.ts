import { Module }           from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * HealthModule — expose GET /api/health et GET /api/health/db
 *
 * SupabaseService est injecté via le SupabaseModule global (@Global())
 * — pas besoin de l'importer explicitement ici.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
