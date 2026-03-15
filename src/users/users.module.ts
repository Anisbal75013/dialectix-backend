import { Module }          from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService }    from './users.service';

@Module({
  controllers: [UsersController],
  providers:   [UsersService],
  exports:     [UsersService],      // exported so BattlesService can update ELO
})
export class UsersModule {}
