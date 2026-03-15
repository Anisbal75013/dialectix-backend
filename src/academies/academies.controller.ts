import {
  Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AcademiesService }  from './academies.service';
import { CreateAcademyDto }  from './dto/create-academy.dto';

@Controller('academies')
export class AcademiesController {
  constructor(private readonly svc: AcademiesService) {}

  /** GET /api/academies */
  @Get()
  findAll() { return this.svc.findAll(); }

  /** GET /api/academies/:id */
  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  /** POST /api/academies */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateAcademyDto) { return this.svc.create(dto); }

  /** POST /api/academies/:id/join */
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  join(
    @Param('id') id: string,
    @Body() body: { user_id: string; role?: string },
  ) {
    return this.svc.addMember(id, body.user_id, body.role);
  }
}
