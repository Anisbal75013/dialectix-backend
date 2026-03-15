import {
  Controller, Get, Post, Patch, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TournamentsService }  from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly svc: TournamentsService) {}

  /** GET /api/tournaments */
  @Get()
  findAll() { return this.svc.findAll(); }

  /** GET /api/tournaments/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  /** POST /api/tournaments */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTournamentDto) { return this.svc.create(dto); }

  /** PATCH /api/tournaments/:id/status */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'pending' | 'active' | 'completed' },
  ) {
    return this.svc.updateStatus(id, body.status);
  }
}
