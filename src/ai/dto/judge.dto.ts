import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class JudgeDto {
  @IsString()
  @IsNotEmpty({ message: 'argument must not be empty' })
  @MaxLength(2000, { message: 'argument must not exceed 2000 characters' })
  argument: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'opponent must not exceed 2000 characters' })
  opponent?: string;

  @IsString()
  @IsNotEmpty({ message: 'topic must not be empty' })
  @MaxLength(500, { message: 'topic must not exceed 500 characters' })
  topic: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  style?: string;
}
