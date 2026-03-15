import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService }                        from '../supabase/supabase.service';
import { CreateTournamentDto }                    from './dto/create-tournament.dto';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(private readonly db: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.db.tournaments()
      .select(`
        id, name, status, start_date, created_at,
        creator:users!tournaments_created_by_fkey(id, username)
      `)
      .order('created_at', { ascending: false });

    if (error) { this.logger.error(error.message); throw new Error(error.message); }
    return data ?? [];
  }

  async findOne(id: string) {
    const { data, error } = await this.db.tournaments()
      .select(`
        id, name, status, start_date, created_at,
        creator:users!created_by(id, username),
        battles(
          id, score_player1, score_player2, winner_id, created_at, topic,
          player1:users!player1_id(id, username),
          player2:users!player2_id(id, username)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Tournament ${id} not found`);
    return data;
  }

  async create(dto: CreateTournamentDto) {
    const { data, error } = await this.db.tournaments()
      .insert({ ...dto, status: dto.status ?? 'pending' })
      .select()
      .single();

    if (error) { this.logger.error(error.message); throw new Error(error.message); }
    return data;
  }

  async updateStatus(id: string, status: 'pending' | 'active' | 'completed') {
    const { data, error } = await this.db.tournaments()
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
