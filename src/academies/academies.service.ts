import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService }                        from '../supabase/supabase.service';
import { CreateAcademyDto }                       from './dto/create-academy.dto';

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(private readonly db: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.db.academies()
      .select(`
        id, name, description, created_at,
        founder:users!founder_id(id, username),
        members:academy_members(
          id, role,
          user:users(id, username, elo)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) { this.logger.error(error.message); throw new Error(error.message); }
    return data ?? [];
  }

  async findOne(id: string) {
    const { data, error } = await this.db.academies()
      .select(`
        id, name, description, created_at,
        founder:users!founder_id(id, username),
        members:academy_members(
          id, role,
          user:users(id, username, elo)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Academy ${id} not found`);
    return data;
  }

  async create(dto: CreateAcademyDto) {
    /* Create academy */
    const { data: academy, error } = await this.db.academies()
      .insert(dto)
      .select()
      .single();

    if (error) { this.logger.error(error.message); throw new Error(error.message); }

    /* Auto-add founder as member with role 'founder' */
    await this.db.academyMembers().insert({
      academy_id: academy.id,
      user_id:    dto.founder_id,
      role:       'founder',
    });

    return academy;
  }

  async addMember(academyId: string, userId: string, role = 'member') {
    const { data, error } = await this.db.academyMembers()
      .upsert({ academy_id: academyId, user_id: userId, role }, { onConflict: 'academy_id,user_id' })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
