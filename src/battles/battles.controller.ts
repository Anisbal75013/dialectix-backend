import {
  Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { BattlesService }  from './battles.service';
import { CreateBattleDto } from './dto/create-battle.dto';

@Controller('battles')
export class BattlesController {
  constructor(private readonly svc: BattlesService) {}

  /** GET /api/battles — last 200 public battles */
  @Get()
  findAll() { return this.svc.findAll(); }

  /** GET /api/battles/stats */
  @Get('stats')
  stats() { return this.svc.stats(); }

  /** GET /api/battles/user/:id */
  @Get('user/:id')
  byUser(@Param('id') id: string) { return this.svc.findByUser(id); }

  /** POST /api/battles — save battle + update ELO */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBattleDto) { return this.svc.create(dto); }
}
