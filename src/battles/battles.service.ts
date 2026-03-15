import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService }    from '../supabase/supabase.service';
import { UsersService }       from '../users/users.service';
import { CreateBattleDto }    from './dto/create-battle.dto';

/* ── Elo calculation (K-factor 32) ───────────────────────────────────────── */
function calcElo(rA: number, rB: number, scoreA: number, scoreB: number) {
  const expected = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const actual   = scoreA > scoreB ? 1 : scoreA < scoreB ? 0 : 0.5;
  const K        = 32;
  const newA     = Math.round(rA + K * (actual - expected));
  const newB     = Math.round(rB + K * ((1 - actual) - (1 - expected)));
  return { newA, newB, deltaA: newA - rA, deltaB: newB - rB };
}

@Injectable()
export class BattlesService {
  private readonly logger = new Logger(BattlesService.name);

  constructor(
    private readonly db:    SupabaseService,
    private readonly users: UsersService,
  ) {}

  async findAll() {
    const { data, error } = await this.db.battles()
      .select(`
        id, score_player1, score_player2, topic, created_at, tournament_id,
        winner_id,
        player1:users!player1_id(id, username, elo),
        player2:users!player2_id(id, username, elo)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) { this.logger.error(error.message); throw new Error(error.message); }
    return data ?? [];
  }

  async findByUser(userId: string) {
    const { data, error } = await this.db.battles()
      .select('id, score_player1, score_player2, topic, winner_id, created_at')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async create(dto: CreateBattleDto) {
    const winner_id =
      dto.score_player1 > dto.score_player2 ? dto.player1_id :
      dto.score_player2 > dto.score_player1 ? dto.player2_id :
      null;

    /* Persist battle */
    const { data: battle, error } = await this.db.battles()
      .insert({ ...dto, winner_id })
      .select()
      .single();

    if (error) {
      this.logger.error(error.message);
      if (error.code === '23503') {
        throw new BadRequestException(
          'player1_id or player2_id does not reference an existing user — register users first',
        );
      }
      throw new Error(error.message);
    }

    /* Update ELO for both players */
    try {
      const [p1, p2] = await Promise.all([
        this.users.findOne(dto.player1_id),
        this.users.findOne(dto.player2_id),
      ]);
      const { newA, newB } = calcElo(
        p1.elo, p2.elo,
        dto.score_player1, dto.score_player2,
      );
      await Promise.all([
        this.users.updateElo(dto.player1_id, newA),
        this.users.updateElo(dto.player2_id, newB),
      ]);
    } catch (e) {
      this.logger.warn(`ELO update skipped: ${e.message}`);
    }

    return battle;
  }

  /** Stats summary for admin dashboard */
  async stats() {
    const { count: total }   = await this.db.battles().select('*', { count: 'exact', head: true });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayC }  = await this.db.battles()
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    return { total: total ?? 0, today: todayC ?? 0 };
  }
}
