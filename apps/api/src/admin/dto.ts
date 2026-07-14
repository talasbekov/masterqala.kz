import { DecisionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecisionDto {
  @IsEnum(DecisionType)
  decision!: DecisionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
