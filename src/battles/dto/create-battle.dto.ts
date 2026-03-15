import {
  IsString, IsNumber, IsOptional, IsUUID, IsArray, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBattleDto {
  @IsUUID()
  player1_id: string;

  @IsUUID()
  player2_id: string;

  /** Score brut 0-10 — stocké en numeric(4,2) dans Supabase */
  @IsNumber() @Min(0) @Max(10) @Type(() => Number)
  score_player1: number;

  @IsNumber() @Min(0) @Max(10) @Type(() => Number)
  score_player2: number;

  @IsString()
  topic: string;

  /** FK optionnelle → tournaments.id */
  @IsOptional()
  @IsUUID()
  tournament_id?: string;

  /** Transcription JSON (jsonb en base) */
  @IsOptional()
  @IsArray()
  transcript?: Record<string, unknown>[];
}
