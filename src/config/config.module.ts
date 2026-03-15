import * as path from 'path';
import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

/**
 * Resolves .env file paths relative to the project root (two levels above
 * this compiled file's directory), so the backend works regardless of the
 * current working directory when `node dist/main` is invoked.
 *
 * Load order (first match wins):
 *   1. .env.<NODE_ENV>   (e.g. .env.development, .env.production)
 *   2. .env              (shared fallback / CI override)
 */
const env     = process.env.NODE_ENV || 'development';
const root    = path.resolve(__dirname, '../../');
const envFiles = [
  path.join(root, `.env.${env}`),
  path.join(root, '.env'),
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal:    true,
      envFilePath: envFiles,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
