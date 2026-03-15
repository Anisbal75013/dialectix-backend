import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class RespondDto {
  /** The human's last argument (or full user-turn content for arena AI) */
  @IsString()
  @IsNotEmpty({ message: 'argument must not be empty' })
  @MaxLength(3000, { message: 'argument must not exceed 3000 characters' })
  argument: string;

  /** Debate bot style: logical | emotional | aggressive | academic | provocative */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  style?: string;

  /** Debate phase: debate | opening | rebuttal | closing */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  phase?: string;

  /** Debate topic — used by aiBotRespond to contextualise the response */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  topic?: string;

  /** Conversation history snippet (last 6 turns) — used by aiBotRespond */
  @IsString()
  @IsOptional()
  @MaxLength(3000)
  history?: string;

  /** Bot display name — used by aiBotRespond */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  botName?: string;

  /**
   * Raw system-level instructions (from generateAIArgument / arenaUtils.js).
   * When present, overrides prompt building and is forwarded directly to Claude
   * as the system role. The `argument` field is used as the user-turn content.
   */
  @IsString()
  @IsOptional()
  @MaxLength(3000)
  system?: string;
}
