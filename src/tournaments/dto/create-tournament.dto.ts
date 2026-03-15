import { IsString, IsOptional, IsUUID, IsDateString, IsIn } from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  name: string;

  @IsUUID()
  created_by: string;

  /** Format ISO date (YYYY-MM-DD) — stocké en type date dans Supabase */
  @IsOptional()
  @IsDateString()
  start_date?: string;

  /** Valeurs autorisées correspondant au check Supabase */
  @IsOptional()
  @IsIn(['pending', 'active', 'completed'])
  status?: 'pending' | 'active' | 'completed';
}
