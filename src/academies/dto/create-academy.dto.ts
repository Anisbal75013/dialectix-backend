import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateAcademyDto {
  @IsString()
  name: string;

  @IsUUID()
  founder_id: string;

  @IsOptional()
  @IsString()
  description?: string;
}
