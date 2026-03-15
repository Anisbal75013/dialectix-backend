import { IsEmail, IsOptional, IsString, IsUUID, Min, IsNumber, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  /** ELO initial — integer en base, 1000 par défaut si absent */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  elo?: number;

  /** FK optionnelle → academies.id (null à la création, mise à jour plus tard) */
  @IsOptional()
  @IsUUID()
  academy_id?: string;
}
