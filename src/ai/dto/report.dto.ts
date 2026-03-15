import { IsString, IsNotEmpty, IsNumber, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportDto {
  /** Side A player name */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nA: string;

  /** Side B player name */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nB: string;

  /** Debate topic */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  topic: string;

  /** Debate format (standard | timer | etc.) */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  format?: string;

  /** Pre-computed weighted score for side A (from gScore) */
  @IsNumber()
  @Type(() => Number)
  scoreA: number;

  /** Pre-computed weighted score for side B (from gScore) */
  @IsNumber()
  @Type(() => Number)
  scoreB: number;

  /** Pre-formatted elapsed time string (MM:SS) */
  @IsString()
  @MaxLength(20)
  elapsedFmt: string;

  /** Joined side A arguments, pre-sliced to 350 chars */
  @IsString()
  @MaxLength(500)
  argsA: string;

  /** Joined side B arguments, pre-sliced to 350 chars */
  @IsString()
  @MaxLength(500)
  argsB: string;

  /** Number of variance events (fallacies detected) */
  @IsNumber()
  @Type(() => Number)
  varCount: number;
}
