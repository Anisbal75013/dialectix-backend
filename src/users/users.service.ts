import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto }   from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly db: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.db.users()
      .select('id, username, email, elo, academy_id, created_at')
      .order('elo', { ascending: false });

    if (error) {
      this.logger.error(`findAll: ${error.message}`);
      throw new Error(error.message);
    }
    return data ?? [];
  }

  async findOne(id: string) {
    const { data, error } = await this.db.users()
      .select('id, username, email, elo, academy_id, created_at')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`User ${id} not found`);
    return data;
  }

  async findByEmail(email: string) {
    const { data } = await this.db.users()
      .select('id, username, email, elo, academy_id, created_at')
      .eq('email', email)
      .single();
    return data ?? null;
  }

  async create(dto: CreateUserDto) {
    // Prevent duplicate email
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException(`Email ${dto.email} already registered`);

    const { data, error } = await this.db.users()
      .insert({ ...dto, elo: dto.elo ?? 1000 })
      .select()
      .single();

    if (error) {
      this.logger.error(`create: ${error.message}`);
      // FK violation = academy_id inexistant
      if (error.code === '23503') {
        throw new BadRequestException(
          `academy_id "${dto.academy_id}" does not exist — create the academy first`,
        );
      }
      throw new Error(error.message);
    }
    return data;
  }

  async updateElo(id: string, newElo: number) {
    const { data, error } = await this.db.users()
      .update({ elo: newElo })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  /** Leaderboard — top 100 by ELO */
  async leaderboard() {
    const { data, error } = await this.db.users()
      .select('id, username, elo, academy_id')
      .order('elo', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return data ?? [];
  }
}
