import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SecurityAuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'HIGH', 'CRITICAL'])
  severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string;

  @IsOptional()
  @IsDateString()
  before?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  beforeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
