import { Module }            from '@nestjs/common';
import { BattlesController } from './battles.controller';
import { BattlesService }    from './battles.service';
import { UsersModule }       from '../users/users.module';

@Module({
  imports:     [UsersModule],
  controllers: [BattlesController],
  providers:   [BattlesService],
  exports:     [BattlesService],
})
export class BattlesModule {}
