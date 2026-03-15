import {
  Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService }  from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  /** GET /api/users — all users sorted by ELO desc */
  @Get()
  findAll() { return this.svc.findAll(); }

  /** GET /api/users/leaderboard — top 100 */
  @Get('leaderboard')
  leaderboard() { return this.svc.leaderboard(); }

  /** GET /api/users/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  /** POST /api/users — create or upsert user (called on first login) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto) { return this.svc.create(dto); }
}
